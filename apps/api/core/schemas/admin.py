"""Typed bodies for the in-app admin (D82). No untyped dicts at the boundary (mandate 4)."""

from ninja import Schema


class ReaderRowOut(Schema):
    """One row of the admin's reader list."""

    id: str
    fullName: str
    email: str
    phone: str
    isActive: bool
    isStaff: bool
    isErased: bool
    bookCount: int
    joinedAt: str


class ReaderListOut(Schema):
    readers: list[ReaderRowOut]


class OwnedBookOut(Schema):
    title: str
    pace: str
    since: str


class ReaderDetailOut(ReaderRowOut):
    books: list[OwnedBookOut]


class ReaderCreateIn(Schema):
    """Adding a reader is granting them a book (D26): a reader never exists
    without one. `bookSlug` comes from `GET /api/books`."""

    fullName: str
    email: str
    phone: str
    bookSlug: str
    pace: str = "medium"


class ReaderCreateOut(Schema):
    reader: ReaderDetailOut
    # Whether chapter 1 left for their WhatsApp. A mistyped number is the likeliest
    # failure, and the admin is the person who can fix it, right now (D26).
    delivered: bool


class ReaderUpdateIn(Schema):
    fullName: str | None = None
    email: str | None = None
    phone: str | None = None


class RefusalOut(Schema):
    """A refusal the form can show next to a field. `field` is None when it
    belongs to the whole form."""

    code: str
    field: str | None = None
