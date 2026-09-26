"""Razorpay: create an order, verify a payment, verify a webhook (D28, D47, D48).

Uses the Orders API (Standard Checkout) instead of Payment Links, because
Razorpay's test mode caps Payment Links at 30 total per account.

This module talks to the gateway and nothing else -- fulfilment is
`onboarding.create_reader`, which is the only door a reader comes through
whether they paid or an admin typed them in.

Unconfigured, `create_order` raises rather than falling back to a fake. Mandate 6
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

API_BASE = "https://api.razorpay.com/v1"


class PaymentsUnavailable(RuntimeError):
    """No Razorpay credentials. Checkout is closed, and says so."""


def configured() -> bool:
    return bool(settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET)


def _auth_header() -> str:
    return base64.b64encode(
        f"{settings.RAZORPAY_KEY_ID}:{settings.RAZORPAY_KEY_SECRET}".encode()
    ).decode()


def _api_call(method: str, path: str, payload: dict | None = None) -> dict:
    data = json.dumps(payload).encode() if payload else None
    request = urllib.request.Request(
        f"{API_BASE}{path}", data=data, method=method,
    )
    request.add_header("Authorization", f"Basic {_auth_header()}")
    request.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.loads(response.read())
    except urllib.error.HTTPError as exc:
        detail = (exc.read() or b"").decode()[:300]
        raise PaymentsUnavailable(f"razorpay refused ({exc.code}): {detail}") from exc


def create_order(*, amount_minor_units, book, full_name, email, phone, pace) -> dict:
    """A Razorpay Order for Standard Checkout.

    Returns the order dict including `id`. The frontend opens the Razorpay
    checkout modal with this order ID and the key ID, then posts the payment
    details back for verification.

    `notes` carries what the confirm endpoint needs to create the reader.
    """
    if not configured():
        raise PaymentsUnavailable("RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not set")

    return _api_call("POST", "/orders", {
        "amount": amount_minor_units,
        "currency": "INR",
        "notes": {
            "full_name": full_name,
            "email": email,
            "phone": phone,
            "book_slug": book.slug,
            "pace": pace,
            "book_title": book.title,
        },
    })


def fetch_order(order_id: str) -> dict:
    """Read an order back from Razorpay."""
    if not configured():
        raise PaymentsUnavailable("no razorpay credentials")
    return _api_call("GET", f"/orders/{order_id}")


def verify_payment_signature(order_id: str, payment_id: str, signature: str) -> bool:
    """Verify Razorpay's Standard Checkout signature.

    The signature is HMAC-SHA256 of `order_id|payment_id` using the key secret.
    """
    message = f"{order_id}|{payment_id}"
    expected = hmac.new(
        settings.RAZORPAY_KEY_SECRET.encode(), message.encode(), hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature or "")


def fetch_payment(payment_id: str) -> dict:
    """Read a payment back from Razorpay to confirm its status."""
    if not configured():
        raise PaymentsUnavailable("no razorpay credentials")
    return _api_call("GET", f"/payments/{payment_id}")


# ── Legacy Payment Links (kept for the webhook, which may still fire) ──────

def create_link(*, amount_minor_units, book, full_name, email, phone, pace, callback_url):
    """Deprecated: use create_order. Kept so old webhook events still parse."""
    if not configured():
        raise PaymentsUnavailable("RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not set")

    return _api_call("POST", "/payment_links", {
        "amount": amount_minor_units,
        "currency": "INR",
        "description": f"Sapien Paradox - {book.title}",
        "customer": {"name": full_name, "email": email, "contact": phone},
        "notify": {"sms": False, "email": False},
        "reminder_enable": False,
        "notes": {
            "full_name": full_name, "email": email, "phone": phone,
            "book_slug": book.slug, "pace": pace,
        },
        "callback_url": callback_url,
        "callback_method": "get",
    })


def fetch_link(payment_link_id: str) -> dict:
    if not configured():
        raise PaymentsUnavailable("no razorpay credentials")
    return _api_call("GET", f"/payment_links/{payment_link_id}")


def signature_is_valid(raw_body: bytes, provided: str) -> bool:
    """HMAC-SHA256 over the EXACT REQUEST BYTES (webhook verification)."""
    secret = settings.RAZORPAY_WEBHOOK_SECRET
    if not secret:
        return False
    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, provided or "")
