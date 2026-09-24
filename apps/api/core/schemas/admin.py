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


# ── books (D83–D86) ───────────────────────────────────────────────────────────


class BookRowOut(Schema):
    id: str
    slug: str
    title: str
    author: str
    isPublished: bool
    chapterCount: int
    readyCount: int
    hasCover: bool
    readerCount: int
    createdAt: str


class BookListOut(Schema):
    books: list[BookRowOut]


class ChapterAdminOut(Schema):
    id: str
    number: int
    title: str
    # `ready`: pages rendered, readable. `failed`: the PDF did not render (D73).
    status: str
    pageCount: int | None
    hasVideo: bool
    hasReaders: bool


class ChecklistOut(Schema):
    hasChapters: bool
    allReady: bool
    hasCover: bool
    passes: bool


class BookDetailOut(BookRowOut):
    description: str
    priceMinorUnits: int
    hasVideo: bool
    hasSample: bool
    chapters: list[ChapterAdminOut]
    checklist: ChecklistOut


class BookIn(Schema):
    title: str
    author: str = ""
    description: str = ""
    priceMinorUnits: int = 0


class BookUpdateIn(Schema):
    title: str | None = None
    author: str | None = None
    description: str | None = None
    priceMinorUnits: int | None = None


class ChapterTitleIn(Schema):
    title: str


class ChapterOrderIn(Schema):
    chapterIds: list[int]


class UploadStartIn(Schema):
    """What the file is and where it goes (D85). `chapterId` for a chapter's PDF
    or video; `title` for a new chapter, cleaned from its filename (D86)."""

    destination: str
    bookId: int
    chapterId: int | None = None
    filename: str
    size: int
    title: str = ""


class UploadPlanOut(Schema):
    ticket: str
    mode: str                      # single | multipart | direct
    url: str | None = None
    uploadId: str | None = None
    partSize: int | None = None
    partUrls: list[str] | None = None
    contentType: str


class UploadPartIn(Schema):
    partNumber: int
    etag: str


class UploadCompleteIn(Schema):
    ticket: str
    parts: list[UploadPartIn] | None = None


class UploadDoneOut(Schema):
    """The book as it is after the upload landed, so the workspace redraws from truth."""

    book: BookDetailOut
    chapterId: str | None = None
