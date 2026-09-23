"""Public checkout and the Razorpay webhook (D47).

The only endpoints an anonymous visitor may call besides login. Paying is what
creates a reader, so this is the front door.

Fulfilment is `onboarding.create_reader` -- the same seam the admin uses (D10,
D26). Payments arrive as a new *caller*, not a new flow.
"""

import json
import logging

from django.conf import settings
from ninja import Router
from ninja.errors import HttpError

from types import SimpleNamespace

from ..machines import dispatch
from ..machines.acquisition import PurchaseAttempt, acquisition_machine
from ..models import Book, MessageLog, Order, PasswordResetToken, User
from ..schemas.checkout import (
    BookCardOut,
    CheckoutIn,
    CheckoutOut,
    ConfirmIn,
    ConfirmOut,
    ResendOut,
)
from ..services import grants, payments, whatsapp
from ..services import phone as phone_service
from ..services.onboarding import OnboardingRefused, create_reader

router = Router()
log = logging.getLogger(__name__)


@router.get("/books", response=list[BookCardOut], auth=None, url_name="books")
def books(request):
    """What is for sale. Published books only -- `is_published` exists so a
    half-built book with three of eight chapters is not immediately buyable."""
    return [
        BookCardOut(
            slug=book.slug,
            title=book.title,
            priceMinorUnits=book.price_cents,
            chapterCount=book.chapters.count(),
        )
        for book in Book.objects.filter(is_published=True).order_by("title")
    ]


@router.post("/checkout", response=CheckoutOut, auth=None, url_name="checkout")
def checkout(request, payload: CheckoutIn):
    """Start a purchase. Returns Razorpay's hosted page to redirect to.

    Nothing is created here. A reader exists only once the money does -- an
    unpaid Order would be an entitlement, and `can_read` would have to start
    asking about payment status, which is exactly the complexity the seam exists
    to keep out of it (D47).
    """
    if not payments.configured():
        raise HttpError(503, "payments_unavailable")

    try:
        book = Book.objects.get(slug=payload.bookSlug, is_published=True)
    except Book.DoesNotExist:
        raise HttpError(404, "no_such_book") from None

    if payload.pace not in ("slow", "medium", "fast"):
        raise HttpError(422, "bad_pace")

    try:
        link = payments.create_link(
            amount_minor_units=book.price_cents,
            book=book,
            full_name=payload.fullName.strip(),
            email=payload.email.strip().lower(),
            phone=phone_service.normalize(payload.phone),
            pace=payload.pace,
            callback_url=f"{settings.APP_BASE_URL}/welcome",
        )
    except payments.PaymentsUnavailable as exc:
        log.error("checkout failed: %s", exc)
        raise HttpError(502, "payment_link_failed") from exc

    return CheckoutOut(paymentUrl=link["short_url"])


def acquisition_deps():
    """What the acquisition machine's guards and actions are handed (D37).

    Plain callables. The machine imports no Django, which is why its tests run
    with no database.
    """
    return SimpleNamespace(
        find_by_email=lambda email: User.objects.filter(
            email__iexact=(email or "").strip()).first(),
        find_by_phone=lambda phone: (
            User.objects.filter(phone=phone_service.normalize(phone)).first()
            if (phone or "").strip() else None
        ),
        book_by_slug=lambda slug: Book.objects.filter(slug=(slug or "").strip()).first(),
        order_for=lambda user, book: (
            Order.objects.select_related("user", "book").filter(user=user, book=book).first()
            if user is not None and book is not None else None
        ),
        order_by_reference=lambda ref: Order.objects.filter(payment_reference=ref).first(),
        adopt_reference=lambda order, ref: Order.objects.filter(pk=order.pk).update(
            payment_reference=ref),
        create_reader=create_reader,
        OnboardingRefused=OnboardingRefused,
        phone_reuse_allowed=lambda: settings.ONBOARDING_ALLOW_PHONE_REUSE,
    )


def _attempt_from(entity) -> PurchaseAttempt:
    notes = entity.get("notes", {}) or {}
    return PurchaseAttempt(
        full_name=(notes.get("full_name") or "").strip(),
        email=(notes.get("email") or "").strip(),
        phone=(notes.get("phone") or "").strip(),
        book_slug=(notes.get("book_slug") or "").strip(),
        pace=notes.get("pace") or "medium",
        payment_reference=entity.get("id", ""),
    )


def _fulfil(entity) -> tuple[str, str, bool]:
    """Create the reader for one paid payment-link entity. (status, detail, delivered)

    Shared by the webhook and the redirect (D48). **Every branch lives in the
    transition table**, not here: this builds the attempt, dispatches, and turns
    the refusal code into the shape the two callers already speak (D38).
    """
    attempt = _attempt_from(entity)
    result = dispatch(acquisition_machine, attempt, "PAID", deps=acquisition_deps())

    if result.ok:
        delivered = bool(
            result.data
            and result.data.chapter_message
            and whatsapp.left_the_building(result.data.chapter_message)
        )
        log.info("fulfilled %s delivered=%s", attempt.payment_reference, delivered)
        return "fulfilled", "", delivered

    if result.refusal == "duplicate":
        log.info("already fulfilled: %s", attempt.payment_reference)
        return "fulfilled", "duplicate", True

    if result.refusal == "already_owns_book":
        # Loud, because a SECOND payment for the same book may need refunding.
        log.warning("already owned: %s", attempt.payment_reference)
        return "owned", "already_owns_book", False

    log.warning("acquisition refused %s: %s", attempt.payment_reference, result.refusal)
    return "refused", result.refusal or "refused", False


@router.post("/checkout/confirm", response=ConfirmOut, auth=None, url_name="checkout_confirm")
def confirm(request, payload: ConfirmIn):
    """The redirect leg (D48). The reader's own browser delivers this.

    The webhook needs a public URL, a dashboard entry, a matching secret and an
    instance that is awake. This needs none of them — which is why V1's spike
    fulfilled here, and why its working run recorded `fulfilled_by: redirect`.

    The id arrives in a query string and is forgeable, so it only selects which link
    to ask Razorpay about. `status == "paid"` is Razorpay's answer, never the browser's.
    """
    if not payments.configured():
        raise HttpError(503, "payments_unavailable")

    try:
        link = payments.fetch_link(payload.paymentLinkId.strip())
    except payments.PaymentsUnavailable as exc:
        log.error("confirm could not read %s: %s", payload.paymentLinkId, exc)
        raise HttpError(502, "payment_lookup_failed") from exc

    if link.get("status") != "paid":
        # Not a failure. Razorpay can lag, and the webhook may still land.
        log.info("confirm: %s is %r, not paid", payload.paymentLinkId, link.get("status"))
        return ConfirmOut(status="pending", delivered=False)

    status, detail, delivered = _fulfil(link)
    return ConfirmOut(status=status, delivered=delivered, detail=detail)


@router.post("/checkout/resend", response=ResendOut, auth=None, url_name="checkout_resend")
def resend(request, payload: ConfirmIn):
    """Send the chapter and the set-a-password link again, after checkout.

    `api/read.py` already has a resend, but it is `session_auth` — useless to the
    reader who needs this most, because D26 leaves them with an unusable password
    and no way to sign in until the very link they are asking for arrives.

    Authorised by the payment link id, the same thing the redirect carries. That
    is safe for the reason `reissue` is safe: **everything goes to the phone on
    the account, never to whoever asked.** Someone holding the id can cause the
    owner to receive a message; they cannot receive one themselves.
    """
    if not payments.configured():
        raise HttpError(503, "payments_unavailable")

    try:
        link = payments.fetch_link(payload.paymentLinkId.strip())
    except payments.PaymentsUnavailable as exc:
        log.error("resend could not read %s: %s", payload.paymentLinkId, exc)
        raise HttpError(502, "payment_lookup_failed") from exc

    if link.get("status") != "paid":
        return ResendOut(status="pending", chapterSent=False, passwordSent=False)

    order = (
        Order.objects.select_related("user", "book")
        .filter(payment_reference=link.get("id", ""))
        .first()
    )

    # The reference only matches when this exact link was the one fulfilled. A
    # reader who paid twice, or was created by concierge onboarding, still owns
    # the book and is still entitled to the links.
    if order is None:
        deps, attempt = acquisition_deps(), _attempt_from(link)
        # Email first, then phone — the same identity the machine resolves, so
        # resend and fulfil can never disagree about who this is.
        user = deps.find_by_email(attempt.email) or deps.find_by_phone(attempt.phone)
        order = deps.order_for(user, deps.book_by_slug(attempt.book_slug))

    # Never fulfilled — resending is meaningless, so do the thing they actually
    # wanted and fulfil, which sends both messages on its way through.
    if order is None:
        status, detail, delivered = _fulfil(link)
        return ResendOut(
            status="sent" if status == "fulfilled" else status,
            chapterSent=delivered,
            passwordSent=delivered,
            detail=detail,
        )

    user = order.user

    if whatsapp.recently_sent(user, "chapter_delivery", settings.CHAPTER_SEND_COOLDOWN_MINUTES):
        # Not an error (D45): it already went, and saying so is the useful answer.
        return ResendOut(status="throttled", chapterSent=False, passwordSent=False)

    chapter = grants.first_chapter_of(order.book)
    if chapter is None:
        return ResendOut(status="refused", chapterSent=False, passwordSent=False,
                         detail="book_has_no_chapters")

    # Reuse a live grant rather than minting: two taps must not leave two live
    # links for one chapter (D27).
    grant = grants.mint_or_reuse(user, chapter)
    chapter_log = whatsapp.send_chapter(grant)
    chapter_sent = whatsapp.left_the_building(chapter_log)

    # Only for a reader who still cannot log in, and only outside its own cooldown.
    password_sent = False
    if not user.has_usable_password() and not whatsapp.recently_sent(
        user, "set_password", settings.RESET_REQUEST_COOLDOWN_MINUTES
    ):
        token = PasswordResetToken.objects.create(user=user)
        password_sent = whatsapp.left_the_building(whatsapp.send_password_reset(token))

    log.info("resend for %s chapter=%s password=%s",
             link.get("id"), chapter_sent, password_sent)

    return ResendOut(
        status="sent" if chapter_sent else "refused",
        chapterSent=chapter_sent,
        passwordSent=password_sent,
        detail="" if chapter_sent else "delivery_failed",
    )


@router.post("/payments/webhook", auth=None, url_name="razorpay_webhook")
def webhook(request):
    """Razorpay tells us the money arrived. The backstop leg (D48).

    Three things this must get right, each of which breaks quietly otherwise:

    1. **Verify before parsing.** The signature is over the raw bytes, so
       `request.body` is read first and nothing re-serialises it.
    2. **Idempotent.** Razorpay retries on any non-2xx *and* on timeout, and since
       D48 the redirect may have fulfilled already. A duplicate does nothing and
       still returns 200.
    3. **Never 500 on a business refusal.** An already-owned book is not an error
       Razorpay should retry.
    """
    raw = request.body                                   # RAW BYTES FIRST
    provided = request.headers.get("X-Razorpay-Signature", "")

    if not payments.signature_is_valid(raw, provided):
        # Fails closed when RAZORPAY_WEBHOOK_SECRET is unset, which is easy to miss
        # and silent — hence D48's second leg. `error`, not `warning`: a rejected
        # webhook means a paid reader got nothing.
        log.error("razorpay webhook refused: signature mismatch or secret unset")
        raise HttpError(400, "bad_signature")

    event = json.loads(raw)
    if event.get("event") != "payment_link.paid":
        return {"status": "ignored", "event": event.get("event")}

    entity = (event.get("payload", {}).get("payment_link", {}) or {}).get("entity", {})
    status, detail, _delivered = _fulfil(entity)

    # The response shape is the webhook's contract, unchanged by D48's refactor.
    # `owned` is a distinction the welcome page needs; to Razorpay it is the same
    # fact as any other refusal — nothing was created, do not retry.
    if status in ("refused", "owned"):
        return {"status": "ok", "refused": detail}
    return {"status": "ok", "duplicate": detail == "duplicate"}
