"""The only way a reader comes into existence (D26).

    onboarding.create_reader(full_name, email, phone, book, pace) -> OnboardingResult

Three rows commit atomically; delivery happens **after** the block and its
`MessageLog` comes back in the result. Rolling back a reader because Twilio
hiccuped turns a delivery problem into a refund problem once payments land.

**Never call this from inside an outer `atomic()`** — the grant would not be
committed when the delivery is handed a link to it.
"""

import logging

from dataclasses import dataclass
from typing import Any

from django.conf import settings
from django.db import transaction

from ..models import Order, PasswordResetToken, TemporalGrant, User
from . import grants as grants_service
from . import phone as phone_service

logger = logging.getLogger(__name__)


class OnboardingRefused(Exception):
    """An identity we cannot safely resolve. Carries the reason and the field."""

    def __init__(self, reason: str, field: str | None = None):
        super().__init__(reason)
        self.reason = reason
        self.field = field


@dataclass
class OnboardingResult:
    user: User
    order: Order
    grant: TemporalGrant
    reset_token: PasswordResetToken | None
    """Minted only for a reader who cannot yet log in; None once they have a password."""
    created: bool
    """False when an existing reader bought another book."""
    chapter_message: Any = None
    """The MessageLog for chapter 1. Present even when the send failed."""
    password_message: Any = None


def create_reader(full_name, email, phone, book, pace) -> OnboardingResult:
    user, created = _resolve_identity(full_name, email, phone)

    with transaction.atomic():
        if created:
            user.save()

        if Order.objects.filter(user=user, book=book).exists():
            raise OnboardingRefused("already_owns_book", "book")

        order = Order.objects.create(user=user, book=book, pace=pace)

        first = grants_service.first_chapter_of(book)
        if first is None:
            raise OnboardingRefused("book_has_no_chapters", "book")

        grant = TemporalGrant.objects.create(user=user, chapter=first)

        # Only for a reader who cannot log in yet. Minting one unconditionally
        # also throttles them: `reset_request` counts PasswordResetToken rows in
        # a window (D31), so an unsent token silently blocks the "send me a
        # sign-in link" they would reach for next.
        needs_password = not user.has_usable_password()
        reset_token = PasswordResetToken.objects.create(user=user) if needs_password else None

    # Outside the transaction, deliberately (D26). A failed send must not
    # discard the reader, and the caller needs to know it failed — a mistyped
    # phone number is the likeliest failure in concierge onboarding, and the
    # person who can fix it is in the admin at that moment.
    from . import whatsapp as whatsapp_service

    chapter_message = whatsapp_service.send_chapter(grant)

    # Gated on the password, not on `created`. A reader who bought once, never
    # set a password, and came back was previously skipped here — so the one
    # message that could let them in was the one we withheld.
    password_message = (
        whatsapp_service.send_password_reset(reset_token) if reset_token is not None else None
    )

    return OnboardingResult(
        user=user,
        order=order,
        grant=grant,
        reset_token=reset_token,
        created=created,
        chapter_message=chapter_message,
        password_message=password_message,
    )


def _resolve_identity(full_name, email, phone) -> tuple[User, bool]:
    """D26's four cases. Reuse on an exact match, refuse on a partial one.

    A changed phone number and a typo'd phone number are *identical* to the
    code, and guessing wrong is expensive both ways: updating silently sends
    chapter links to a stranger's phone, and creating a second account loses the
    reader the book they paid for. An admin can tell in two seconds; we cannot.
    """
    # One spelling, or `+918712740175` and `8712740175` become two readers —
    # and `User.phone` is unique on the string, so one human holds two accounts.
    phone = phone_service.normalize(phone)

    by_email = User.objects.filter(email__iexact=email).first()
    by_phone = User.objects.filter(phone=phone).first()

    if by_email is None and by_phone is None:
        user = User(email=email, full_name=full_name, phone=phone)
        # No password. They read chapter 1 from the WhatsApp link, and the
        # reset link is how they reach Home (D26).
        user.set_unusable_password()
        return user, True

    if by_email is not None and by_email == by_phone:
        return by_email, False

    if by_email is not None and by_phone is not None:
        raise OnboardingRefused("identity_belongs_to_two_readers", "email,phone")

    # TEMPORARY (settings.ONBOARDING_ALLOW_PHONE_REUSE) — revert before real readers.
    # A known phone with an unknown email is normally refused, which makes the flow
    # untestable with one phone number. When the flag is on we treat the phone as
    # the identity and reuse that reader; the new email is ignored rather than
    # overwriting theirs, because silently rewriting an account's email from a
    # checkout form is the more dangerous half of this.
    if by_phone is not None and settings.ONBOARDING_ALLOW_PHONE_REUSE:
        logger.warning(
            "ONBOARDING_ALLOW_PHONE_REUSE: reusing reader %s for a signup that gave "
            "a different email. This must not be on in production.", by_phone.pk
        )
        return by_phone, False

    raise OnboardingRefused(
        "partial_identity_match", "phone" if by_email is not None else "email"
    )
