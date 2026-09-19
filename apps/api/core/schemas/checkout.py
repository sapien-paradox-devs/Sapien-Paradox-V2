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
