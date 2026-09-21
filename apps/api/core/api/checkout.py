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

from ..models import Book, Order
from ..models import MessageLog, User
from ..models import PasswordResetToken
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


def _existing_order(notes, book):
    """The reader's order for this book, found without the payment reference.

    `payment_reference` is the idempotency key, but it only matches when the same
    link is replayed. An order created by an earlier payment, or by concierge
    onboarding with no reference at all, is invisible to it — and then a replay
    runs `create_reader` and is refused for a book the reader already owns.
    """
    phone = phone_service.normalize(notes.get("phone"))
    email = (notes.get("email") or "").strip()

    user = None
    if phone:
        user = User.objects.filter(phone=phone).first()
    if user is None and email:
        user = User.objects.filter(email__iexact=email).first()
    if user is None:
        return None

    return Order.objects.select_related("user", "book").filter(user=user, book=book).first()


def _fulfil(entity) -> tuple[str, str, bool]:
    """Create the reader for one paid payment-link entity. (status, detail, delivered)

    Shared by the webhook and the redirect (D48). Idempotent on
    `Order.payment_reference`, which the webhook already relied on for Razorpay's
    own retries — two legs is that same property with a different caller.
    """
    notes = entity.get("notes", {}) or {}
    payment_ref = entity.get("id", "")

    if payment_ref and Order.objects.filter(payment_reference=payment_ref).exists():
        log.info("already fulfilled: %s", payment_ref)
        return "fulfilled", "duplicate", True

    try:
        book = Book.objects.get(slug=notes.get("book_slug", ""))
    except Book.DoesNotExist:
        log.error("unknown book %r on %s", notes.get("book_slug"), payment_ref)
        return "refused", "unknown_book", False

    # No outer transaction: `create_reader` opens its own (D26), and wrapping it in a
    # second one means a refusal raised inside leaves the outer marked for rollback,
    # so even the handled path can no longer touch the database.
    try:
        result = create_reader(
            full_name=notes.get("full_name", ""),
            email=notes.get("email", ""),
            phone=notes.get("phone", ""),
            book=book,
            pace=notes.get("pace", "medium"),
        )
    except OnboardingRefused as exc:
        if exc.reason == "already_owns_book":
            # Not a refusal from the reader's side: they own it, the grant exists,
            # and what they want is the links again. Refusing here made the one
            # case that is trivially serviceable into the only dead end.
            owned = _existing_order(notes, book)
            if owned is not None and payment_ref and not owned.payment_reference:
                # Adopt the reference so the next replay short-circuits above.
                Order.objects.filter(pk=owned.pk).update(payment_reference=payment_ref)
            # Loud, because a SECOND payment for the same book may need refunding.
            log.warning("already owned: %s (order %s)", payment_ref,
                        owned.pk if owned else "not found")
            return "owned", "already_owns_book", False

        log.warning("onboarding refused %s: %s", payment_ref, exc.reason)
        return "refused", exc.reason, False

    if payment_ref:
        Order.objects.filter(pk=result.order.pk).update(payment_reference=payment_ref)

    delivered = bool(
        result.chapter_message and result.chapter_message.status == MessageLog.SENT
    )
    log.info("fulfilled %s delivered=%s", payment_ref, delivered)
    return "fulfilled", "", delivered


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
        notes = link.get("notes", {}) or {}
        book = Book.objects.filter(slug=notes.get("book_slug", "")).first()
        if book is not None:
            order = _existing_order(notes, book)

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
    chapter_sent = chapter_log.status == MessageLog.SENT

    # Only for a reader who still cannot log in, and only outside its own cooldown.
    password_sent = False
    if not user.has_usable_password() and not whatsapp.recently_sent(
        user, "set_password", settings.RESET_REQUEST_COOLDOWN_MINUTES
    ):
        token = PasswordResetToken.objects.create(user=user)
        password_sent = whatsapp.send_password_reset(token).status == MessageLog.SENT

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
