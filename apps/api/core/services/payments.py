"""Razorpay: create a payment link, verify a webhook (D28, D47).

Two functions, and deliberately no more. This module talks to the gateway and
nothing else -- fulfilment is `onboarding.create_reader`, which is the only door
a reader comes through whether they paid or an admin typed them in.

Unconfigured, `create_link` raises rather than falling back to a fake. Mandate 6
gives externals a console fallback so a fresh clone runs, but a *silent* fake
payment is worse than a loud failure: the reader would believe they had bought
something.
"""

import base64
import hashlib
import hmac
import json
import urllib.error
import urllib.request

from django.conf import settings

API = "https://api.razorpay.com/v1/payment_links"


class PaymentsUnavailable(RuntimeError):
    """No Razorpay credentials. Checkout is closed, and says so."""


def configured() -> bool:
    return bool(settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET)


def create_link(*, amount_minor_units, book, full_name, email, phone, pace, callback_url):
    """A hosted Razorpay Payment Link. Returns its `short_url`.

    **Amounts are in the minor unit** -- paise, not rupees. The spike sent
    `amount: 1000` for Rs 10 and Razorpay accepted it, which is also why
    `Book.price_cents` is misnamed rather than wrong.

    `notes` is the metadata channel, capped at 15 string keys. It carries what
    the webhook needs to create the reader. **No password** (D47): a paying
    reader gets a set-a-password link over WhatsApp (D26), so nothing needs to
    carry a credential through a third party's metadata store.
    """
    if not configured():
        raise PaymentsUnavailable("RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not set")

    payload = {
        "amount": amount_minor_units,
        "currency": "INR",
        "description": f"Sapien Paradox - {book.title}",
        "customer": {"name": full_name, "email": email, "contact": phone},
        "notify": {"sms": False, "email": False},
        "reminder_enable": False,
        "notes": {
            "full_name": full_name,
            "email": email,
            "phone": phone,
            "book_slug": book.slug,
            "pace": pace,
        },
        "callback_url": callback_url,
        "callback_method": "get",
    }

    auth = base64.b64encode(
        f"{settings.RAZORPAY_KEY_ID}:{settings.RAZORPAY_KEY_SECRET}".encode()
    ).decode()

    request = urllib.request.Request(API, data=json.dumps(payload).encode(), method="POST")
    request.add_header("Authorization", f"Basic {auth}")
    request.add_header("Content-Type", "application/json")

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.loads(response.read())
    except urllib.error.HTTPError as exc:
        detail = (exc.read() or b"").decode()[:300]
        raise PaymentsUnavailable(f"razorpay refused ({exc.code}): {detail}") from exc


def signature_is_valid(raw_body: bytes, provided: str) -> bool:
    """HMAC-SHA256 over the EXACT REQUEST BYTES.

    Parsing the JSON and re-serialising produces different bytes and therefore a
    different digest -- the classic way this integration breaks, and it breaks
    only in production, where a real payload's byte order differs from a fixture's.
    The endpoint reads `request.body` before it parses anything.

    Compared in constant time: a plain `==` leaks how many leading characters
    were right, which is enough to forge a signature given attempts.
    """
    secret = settings.RAZORPAY_WEBHOOK_SECRET
    if not secret:
        return False

    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, provided or "")
