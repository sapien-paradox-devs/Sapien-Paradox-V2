"""Checkout bodies (mandate 4)."""

from ninja import Schema


class CheckoutIn(Schema):
    fullName: str
    email: str
    phone: str
    bookSlug: str
    pace: str


class CheckoutOut(Schema):
    """`paymentUrl` is Razorpay's hosted page. The SPA redirects there."""

    paymentUrl: str


class BookCardOut(Schema):
    """What the landing page renders per book. No chapter list -- a visitor has
    not bought anything, and D11's read/unread marks belong to a reader."""

    slug: str
    title: str
    priceMinorUnits: int
    chapterCount: int


class ConfirmIn(Schema):
    """`razorpay_payment_link_id`, as Razorpay appends it to the callback URL."""

    paymentLinkId: str


class ConfirmOut(Schema):
    """What the welcome page can honestly say.

    `fulfilled` means a reader now exists — by this call or by the webhook getting
    there first. `pending` means Razorpay does not report the link as paid yet, which
    is not the same as failed.
    """

    status: str          # "fulfilled" | "pending" | "refused"
    delivered: bool      # whether the chapter message actually left
    detail: str = ""     # a refusal reason, for the page to explain
