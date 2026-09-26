"""Checkout bodies (mandate 4)."""

from ninja import Schema


class CheckoutIn(Schema):
    fullName: str
    email: str
    phone: str
    bookSlug: str
    pace: str


class CheckoutOut(Schema):
    """What the SPA needs to open Razorpay's Standard Checkout modal."""

    orderId: str
    keyId: str
    amount: int
    currency: str
    bookTitle: str


class BookCardOut(Schema):
    """What the landing page renders per book. No chapter list -- a visitor has
    not bought anything, and D11's read/unread marks belong to a reader."""

    slug: str
    title: str
    priceMinorUnits: int
    chapterCount: int


class ConfirmIn(Schema):
    """Posted by the SPA after Razorpay's modal reports success.

    All three fields come from the modal's `handler(response)`. When only
    `razorpayOrderId` is present (welcome-page reload), the backend falls back
    to fetching the order status from Razorpay directly.
    """

    razorpayOrderId: str
    razorpayPaymentId: str = ""
    razorpaySignature: str = ""


class ResendIn(Schema):
    """Identifies a paid order so the welcome page can re-send messages."""

    razorpayOrderId: str


class ConfirmOut(Schema):
    """What the welcome page can honestly say.

    `fulfilled` means a reader now exists — by this call or by the webhook getting
    there first. `pending` means Razorpay does not report the order as paid yet,
    which is not the same as failed.
    """

    status: str          # "fulfilled" | "pending" | "refused"
    delivered: bool      # whether the chapter message actually left
    detail: str = ""     # a refusal reason, for the page to explain


class ResendOut(Schema):
    """What was actually re-sent, so the page can say so rather than guess."""

    status: str            # "sent" | "pending" | "refused" | "throttled"
    chapterSent: bool
    passwordSent: bool
    detail: str = ""
