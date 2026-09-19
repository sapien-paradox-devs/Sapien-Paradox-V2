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
from ..schemas.checkout import BookCardOut, CheckoutIn, CheckoutOut
from ..services import payments
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
            phone=payload.phone.strip(),
            pace=payload.pace,
            callback_url=f"{settings.APP_BASE_URL}/welcome",
        )
    except payments.PaymentsUnavailable as exc:
        log.error("checkout failed: %s", exc)
        raise HttpError(502, "payment_link_failed") from exc

    return CheckoutOut(paymentUrl=link["short_url"])


@router.post("/payments/webhook", auth=None, url_name="razorpay_webhook")
def webhook(request):
    """Razorpay tells us the money arrived. This creates the reader.

    Three things this must get right, each of which breaks quietly otherwise:

    1. **Verify before parsing.** The signature is over the raw bytes, so
       `request.body` is read first and nothing re-serialises it.
    2. **Idempotent.** Razorpay retries on any non-2xx *and* on timeout, so the
       same event will arrive twice. A duplicate does nothing and still returns
       200 -- replying non-2xx would make it retry what already succeeded.
    3. **Never 500 on a business refusal.** An already-owned book is not an
       error Razorpay should retry.
    """
    raw = request.body                                   # RAW BYTES FIRST
    provided = request.headers.get("X-Razorpay-Signature", "")

    if not payments.signature_is_valid(raw, provided):
        log.warning("razorpay webhook refused: signature mismatch")
        raise HttpError(400, "bad_signature")

    event = json.loads(raw)
    if event.get("event") != "payment_link.paid":
        return {"status": "ignored", "event": event.get("event")}

    entity = (event.get("payload", {}).get("payment_link", {}) or {}).get("entity", {})
    notes = entity.get("notes", {}) or {}
    payment_ref = entity.get("id", "")

    # Idempotency, on the payment reference rather than a separate ledger: the
    # Order is written anyway, and a second table would be a second truth.
    if payment_ref and Order.objects.filter(payment_reference=payment_ref).exists():
        log.info("razorpay webhook: %s already fulfilled", payment_ref)
        return {"status": "ok", "duplicate": True}

    try:
        book = Book.objects.get(slug=notes.get("book_slug", ""))
    except Book.DoesNotExist:
        log.error("razorpay webhook: unknown book %r", notes.get("book_slug"))
        return {"status": "ok", "ignored": "unknown_book"}

    # No outer transaction here. `create_reader` opens its own (D26), and
    # wrapping it in a second one means a refusal raised inside the inner block
    # leaves the outer one marked for rollback -- so even the handled path can
    # no longer touch the database.
    try:
        result = create_reader(
            full_name=notes.get("full_name", ""),
            email=notes.get("email", ""),
            phone=notes.get("phone", ""),
            book=book,
            pace=notes.get("pace", "medium"),
        )
    except OnboardingRefused as exc:
        # A refusal is a fact, not a failure Razorpay should retry.
        log.warning("razorpay webhook refused by onboarding: %s", exc.reason)
        return {"status": "ok", "refused": exc.reason}

    if payment_ref:
        Order.objects.filter(pk=result.order.pk).update(payment_reference=payment_ref)

    log.info("razorpay webhook fulfilled %s", payment_ref)
    return {"status": "ok", "duplicate": False}
