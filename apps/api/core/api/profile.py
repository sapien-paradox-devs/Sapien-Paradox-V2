"""Profile — account details and book progress (#217).

Session-gated. No machine: profile edits are CRUD, not a flow with states.
Email clash uses the same `OnboardingRefused` the admin PATCH already uses.
"""

from django.http import HttpResponse
from ninja import Router
from ninja.errors import HttpError

from ..auth import session_auth
from ..models import Chapter, Order
from ..schemas.profile import (
    BookProgressOut,
    PasswordIn,
    ProfileOut,
    ProfileUpdateIn,
)
from ..services import onboarding
from .. import selectors

router = Router()


def _profile(user) -> ProfileOut:
    orders = Order.objects.filter(user=user).select_related("book").order_by("created_at")
    places = selectors.progress_by_chapter(user)

    books = []
    for order in orders:
        chapters = list(Chapter.objects.filter(book=order.book).order_by("order_index"))
        total = len(chapters)
        unlocked = sum(1 for c in chapters if places.get(c.pk, selectors.NONE).furthest > 0)
        progress = sum(places.get(c.pk, selectors.NONE).furthest for c in chapters) / total if total else 0.0
        books.append(BookProgressOut(
            title=order.book.title,
            chaptersUnlocked=unlocked,
            chaptersTotal=total,
            progress=progress,
        ))

    return ProfileOut(
        fullName=user.full_name,
        email=user.email,
        phone=user.phone,
        hasPassword=user.has_usable_password(),
        avatarSeed=user.avatar_seed,
        books=books,
    )


@router.get("/profile", response=ProfileOut, auth=session_auth, url_name="profile")
def get_profile(request):
    return _profile(request.auth)


@router.patch("/profile", response=ProfileOut, auth=session_auth, url_name="profile_update")
def update_profile(request, payload: ProfileUpdateIn):
    user = request.auth

    if payload.avatarSeed is not None:
        user.avatar_seed = payload.avatarSeed
        user.save(update_fields=["avatar_seed"])

    if payload.fullName is not None or payload.email is not None:
        try:
            onboarding.update_reader(
                user,
                full_name=payload.fullName,
                email=payload.email,
                by=user,
            )
        except onboarding.OnboardingRefused as refused:
            raise HttpError(409, refused.reason)

    return _profile(request.auth)


@router.post("/auth/password", auth=session_auth, url_name="change_password")
def change_password(request, payload: PasswordIn):
    user = request.auth

    if len(payload.newPassword) < 8:
        raise HttpError(400, "password_too_short")

    if user.has_usable_password():
        if not payload.currentPassword:
            raise HttpError(400, "current_password_required")
        if not user.check_password(payload.currentPassword):
            raise HttpError(403, "wrong_password")

    user.set_password(payload.newPassword)
    user.save(update_fields=["password"])

    from django.contrib.auth import update_session_auth_hash
    update_session_auth_hash(request, user)

    return {"ok": True}
