"""The in-app admin's API (D82). Staff only: every endpoint declares `staff_auth`.

**HTTP only.** Reads go through `selectors` (D61); every change is a service in
`services/onboarding.py` (D80), and adding a reader goes through the acquisition
machine, so the four identity cases of D26 apply to an admin exactly as they
apply to a payment. Nothing here decides who a reader is.

CSRF is enforced, as on every session endpoint (D30): a staff session is the
most valuable ambient authority the product has.
"""

from ninja import Router
from ninja.errors import HttpError

from .. import selectors
from ..auth import staff_auth
from ..machines import dispatch
from ..machines.acquisition import PurchaseAttempt, acquisition_machine
from ..schemas.admin import (
    OwnedBookOut,
    ReaderCreateIn,
    ReaderCreateOut,
    ReaderDetailOut,
    ReaderListOut,
    ReaderRowOut,
    ReaderUpdateIn,
    RefusalOut,
)
from ..services import onboarding, whatsapp
from .checkout import acquisition_deps

router = Router()

# Which form field each acquisition refusal belongs to, so the screen can put the
# message where the admin is looking.
_REFUSAL_FIELD = {
    "already_owns_book": "bookSlug",
    "unknown_book": "bookSlug",
    "book_has_no_chapters": "bookSlug",
    "identity_belongs_to_two_readers": "email",
    "partial_identity_match": "email",
    "email_taken": "email",
    "phone_taken": "phone",
    "invalid_phone": "phone",
}


def _row(user) -> ReaderRowOut:
    return ReaderRowOut(**_row_fields(user))


def _row_fields(user) -> dict:
    return dict(
        id=str(user.pk),
        fullName=user.full_name,
        email=user.email,
        phone=user.phone,
        isActive=user.is_active,
        isStaff=user.is_staff,
        isErased=selectors.is_erased(user),
        bookCount=getattr(user, "book_count", None) or user.orders.count(),
        joinedAt=user.date_joined.isoformat(),
    )


def _detail(user) -> ReaderDetailOut:
    return ReaderDetailOut(
        **_row_fields(user),
        books=[
            OwnedBookOut(title=o.book.title, pace=o.pace, since=o.created_at.isoformat())
            for o in selectors.orders_of(user)
        ],
    )


def _reader_or_404(reader_id: int):
    user = selectors.reader(reader_id)
    if user is None:
        raise HttpError(404, "no_such_reader")
    return user


def _refused(code: str):
    return 409, RefusalOut(code=code, field=_REFUSAL_FIELD.get(code))


@router.get("/admin/readers", response=ReaderListOut, auth=staff_auth, url_name="admin_readers")
def list_readers(request, search: str = "", status: str = "all"):
    return ReaderListOut(readers=[_row(u) for u in selectors.readers(search, status)[:200]])


@router.get("/admin/readers/{reader_id}", response=ReaderDetailOut, auth=staff_auth,
            url_name="admin_reader")
def get_reader(request, reader_id: int):
    return _detail(_reader_or_404(reader_id))


@router.post("/admin/readers", response={201: ReaderCreateOut, 409: RefusalOut},
             auth=staff_auth, url_name="admin_reader_create")
def create_reader(request, payload: ReaderCreateIn):
    """Add a reader by granting them a book (D26, D80).

    A concierge order is a purchase attempt with no payment reference, which is
    what concierge orders have always been (D47). Dispatching it through the
    acquisition machine means a returning reader gets the book added, and a
    submission whose email and phone belong to two different people is refused,
    exactly as at checkout.
    """
    attempt = PurchaseAttempt(
        full_name=payload.fullName.strip(),
        email=payload.email.strip(),
        phone=payload.phone.strip(),
        book_slug=payload.bookSlug.strip(),
        pace=payload.pace,
    )
    result = dispatch(acquisition_machine, attempt, "PAID", deps=acquisition_deps())
    if not result.ok:
        return _refused(result.refusal or "refused")

    # A returning reader given another book is an `Order`, not an account change.
    if result.data.created:
        onboarding.record_change(result.data.user, "created", by=request.auth)
    delivered = bool(
        result.data.chapter_message and whatsapp.left_the_building(result.data.chapter_message)
    )
    return 201, ReaderCreateOut(reader=_detail(_reader_or_404(result.data.user.pk)),
                                delivered=delivered)


@router.patch("/admin/readers/{reader_id}", response={200: ReaderDetailOut, 409: RefusalOut},
              auth=staff_auth, url_name="admin_reader_update")
def update_reader(request, reader_id: int, payload: ReaderUpdateIn):
    user = _reader_or_404(reader_id)
    if selectors.is_erased(user):
        return _refused("erased")
    try:
        onboarding.update_reader(
            user, full_name=payload.fullName, email=payload.email, phone=payload.phone,
            by=request.auth,
        )
    except onboarding.OnboardingRefused as refused:
        return _refused(refused.reason)
    return 200, _detail(_reader_or_404(reader_id))


@router.post("/admin/readers/{reader_id}/deactivate", response=ReaderDetailOut,
             auth=staff_auth, url_name="admin_reader_deactivate")
def deactivate_reader(request, reader_id: int):
    user = _reader_or_404(reader_id)
    if user.pk == request.auth.pk:
        # Locking yourself out of the admin is never what was meant.
        raise HttpError(409, "cannot_deactivate_self")
    onboarding.deactivate_reader(user, by=request.auth)
    return _detail(_reader_or_404(reader_id))


@router.post("/admin/readers/{reader_id}/reactivate", response={200: ReaderDetailOut, 409: RefusalOut},
             auth=staff_auth, url_name="admin_reader_reactivate")
def reactivate_reader(request, reader_id: int):
    user = _reader_or_404(reader_id)
    try:
        onboarding.reactivate_reader(user, by=request.auth)
    except onboarding.OnboardingRefused as refused:
        return _refused(refused.reason)
    return 200, _detail(_reader_or_404(reader_id))


@router.post("/admin/readers/{reader_id}/erase", response=ReaderDetailOut,
             auth=staff_auth, url_name="admin_reader_erase")
def erase_reader(request, reader_id: int):
    """Irreversible (D80). The screen asks twice; this endpoint trusts that it did."""
    user = _reader_or_404(reader_id)
    if user.pk == request.auth.pk:
        raise HttpError(409, "cannot_erase_self")
    onboarding.erase_reader(user, by=request.auth)
    return _detail(_reader_or_404(reader_id))
