"""Public checkout and the Razorpay webhook (D47).

The only endpoints an anonymous visitor may call besides login. Paying is what
creates a reader, so this is the front door.

Fulfilment is `onboarding.create_reader` -- the same seam the admin uses (D10,
D26). Payments arrive as a new *caller*, not a new flow.

Uses the Orders API (Standard Checkout) instead of Payment Links, because
Razorpay's test mode caps Payment Links at 30 total per account.
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
    ResendIn,
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
    """Start a purchase. Returns what the SPA needs for Razorpay's modal.

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
        order = payments.create_order(
            amount_minor_units=book.price_cents,
            book=book,
            full_name=payload.fullName.strip(),
            email=payload.email.strip().lower(),
            phone=phone_service.normalize(payload.phone),
            pace=payload.pace,
        )
    except payments.PaymentsUnavailable as exc:
        log.error("checkout failed: %s", exc)
        raise HttpError(502, "checkout_failed") from exc

    return CheckoutOut(
        orderId=order["id"],
        keyId=settings.RAZORPAY_KEY_ID,
        amount=order["amount"],
        currency=order["currency"],
        bookTitle=book.title,
    )


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


def _fulfil(entity) -> tuple[str, str, bool, bool]:
    """Create the reader for one paid entity (order or payment link).

    Shared by the confirm endpoint and the webhook (D48). **Every branch lives
    in the transition table**, not here: this builds the attempt, dispatches, and
    turns the refusal code into the shape the two callers already speak (D38).

    Returns (status, detail, delivered, has_phone).
    """
    attempt = _attempt_from(entity)
    has_phone = bool(attempt.phone)
    result = dispatch(acquisition_machine, attempt, "PAID", deps=acquisition_deps())

    if result.ok:
        delivered = bool(
            result.data
            and result.data.chapter_message
            and whatsapp.left_the_building(result.data.chapter_message)
        )
        log.info("fulfilled %s delivered=%s", attempt.payment_reference, delivered)
        return "fulfilled", "", delivered, has_phone

    if result.refusal == "duplicate":
        log.info("already fulfilled: %s", attempt.payment_reference)
        return "fulfilled", "duplicate", has_phone, has_phone

    if result.refusal == "already_owns_book":
        log.warning("already owned: %s", attempt.payment_reference)
        return "owned", "already_owns_book", False, has_phone

    log.warning("acquisition refused %s: %s", attempt.payment_reference, result.refusal)
    return "refused", result.refusal or "refused", False, has_phone


@router.post("/checkout/confirm", response=ConfirmOut, auth=None, url_name="checkout_confirm")
def confirm(request, payload: ConfirmIn):
    """Verify a payment and fulfil the reader.

    Two paths, same outcome:
    1. **Signature path** (from the begin page): all three fields present →
       verify HMAC (fast, no Razorpay round-trip for verification).
    2. **Lookup path** (from the welcome page on reload): only order ID →
       fetch from Razorpay and check `status == "paid"`.

    Both paths then fetch the order's notes and fulfil through the acquisition
    machine. Idempotent: a second call for an already-fulfilled order returns
    `fulfilled` with `detail: "duplicate"`.
    """
    if not payments.configured():
        raise HttpError(503, "payments_unavailable")

    has_signature = bool(payload.razorpayPaymentId and payload.razorpaySignature)

    if has_signature:
        if not payments.verify_payment_signature(
            payload.razorpayOrderId, payload.razorpayPaymentId, payload.razorpaySignature,
        ):
            log.warning("confirm: invalid signature for %s", payload.razorpayOrderId)
            raise HttpError(400, "invalid_signature")

    try:
        order = payments.fetch_order(payload.razorpayOrderId.strip())
    except payments.PaymentsUnavailable as exc:
        log.error("confirm could not read %s: %s", payload.razorpayOrderId, exc)
        raise HttpError(502, "payment_lookup_failed") from exc

    if not has_signature and order.get("status") != "paid":
        log.info("confirm: %s is %r, not paid", payload.razorpayOrderId, order.get("status"))
        return ConfirmOut(status="pending", delivered=False)

    status, detail, delivered, has_phone = _fulfil(order)

    if payload.password and status == "fulfilled":
        notes = order.get("notes", {}) or {}
        email = (notes.get("email") or "").strip()
        user = User.objects.filter(email__iexact=email).first() if email else None
        if user and not user.has_usable_password():
            user.set_password(payload.password)
            user.save(update_fields=["password"])

    return ConfirmOut(status=status, delivered=delivered, detail=detail, hasPhone=has_phone)


@router.post("/checkout/resend", response=ResendOut, auth=None, url_name="checkout_resend")
def resend(request, payload: ResendIn):
    """Send the chapter and the set-a-password link again, after checkout.

    Authorised by the Razorpay order id. That is safe for the reason `reissue`
    is safe: **everything goes to the phone on the account, never to whoever
    asked.** Someone holding the id can cause the owner to receive a message;
    they cannot receive one themselves.
    """
    if not payments.configured():
        raise HttpError(503, "payments_unavailable")

    try:
        rzp_order = payments.fetch_order(payload.razorpayOrderId.strip())
    except payments.PaymentsUnavailable as exc:
        log.error("resend could not read %s: %s", payload.razorpayOrderId, exc)
        raise HttpError(502, "payment_lookup_failed") from exc

    if rzp_order.get("status") != "paid":
        return ResendOut(status="pending", chapterSent=False, passwordSent=False)

    order = (
        Order.objects.select_related("user", "book")
        .filter(payment_reference=rzp_order.get("id", ""))
        .first()
    )

    if order is None:
        deps, attempt = acquisition_deps(), _attempt_from(rzp_order)
        user = deps.find_by_email(attempt.email) or deps.find_by_phone(attempt.phone)
        order = deps.order_for(user, deps.book_by_slug(attempt.book_slug))

    if order is None:
        status, detail, delivered, _has_phone = _fulfil(rzp_order)
        return ResendOut(
            status="sent" if status == "fulfilled" else status,
            chapterSent=delivered,
            passwordSent=delivered,
            detail=detail,
        )

    user = order.user

    if not user.phone:
        return ResendOut(status="refused", chapterSent=False, passwordSent=False,
                         detail="no_phone")

    if whatsapp.recently_sent(user, "chapter_delivery", settings.CHAPTER_SEND_COOLDOWN_MINUTES):
        return ResendOut(status="throttled", chapterSent=False, passwordSent=False)

    chapter = grants.first_chapter_of(order.book)
    if chapter is None:
        return ResendOut(status="refused", chapterSent=False, passwordSent=False,
                         detail="book_has_no_chapters")

    grant = grants.mint_or_reuse(user, chapter)
    chapter_log = whatsapp.send_chapter(grant)
    chapter_sent = whatsapp.left_the_building(chapter_log)

    password_sent = False
    if not user.has_usable_password() and not whatsapp.recently_sent(
        user, "set_password", settings.RESET_REQUEST_COOLDOWN_MINUTES
    ):
        token = PasswordResetToken.objects.create(user=user)
        password_sent = whatsapp.left_the_building(whatsapp.send_password_reset(token))

    log.info("resend for %s chapter=%s password=%s",
             rzp_order.get("id"), chapter_sent, password_sent)

    return ResendOut(
        status="sent" if chapter_sent else "refused",
        chapterSent=chapter_sent,
        passwordSent=password_sent,
        detail="" if chapter_sent else "delivery_failed",
    )


@router.post("/payments/webhook", auth=None, url_name="razorpay_webhook")
def webhook(request):
    """Razorpay tells us the money arrived. The backstop leg (D48).

    Handles both `payment_link.paid` (legacy) and `order.paid` (Standard
    Checkout) events.
    """
    raw = request.body
    provided = request.headers.get("X-Razorpay-Signature", "")

    if not payments.signature_is_valid(raw, provided):
        log.error("razorpay webhook refused: signature mismatch or secret unset")
        raise HttpError(400, "bad_signature")

    event = json.loads(raw)
    event_type = event.get("event")

    if event_type == "payment_link.paid":
        entity = (event.get("payload", {}).get("payment_link", {}) or {}).get("entity", {})
    elif event_type == "order.paid":
        entity = (event.get("payload", {}).get("order", {}) or {}).get("entity", {})
    else:
        return {"status": "ignored", "event": event_type}

    status, detail, _delivered, _has_phone = _fulfil(entity)

    if status in ("refused", "owned"):
        return {"status": "ok", "refused": detail}
    return {"status": "ok", "duplicate": detail == "duplicate"}
