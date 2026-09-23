from ninja import Schema


class HealthOut(Schema):
    status: str
    database: str


class ChapterOut(Schema):
    """What the reading chamber needs to render its header.

    Deliberately not the whole Chapter: `text_content` is the companion's
    context and would be a few hundred kilobytes on every open, and `file` is a
    storage path that must never reach a client (D19).
    """

    bookTitle: str
    number: int
    title: str
    # True only on the request that stamped `opened_at`: the chamber plays its
    # threshold ceremony once per link, and the server is what knows (#116).
    # Nothing client-side remembers a token (D22).
    firstOpen: bool
    # Where the reader got to last time, so the progress line picks up there,
    # and whether they already marked the chapter complete (D70).
    furthest: float
    completed: bool


class ChatIn(Schema):
    """The panel's existing contract: the token identifies the chapter, and the
    question is one turn. History is not sent -- the companion is chapter-scoped
    and the chapter is the context that matters (D13)."""

    token: str
    question: str


class ChatOut(Schema):
    answer: str


class PageSizeOut(Schema):
    """A page's size in PDF points, so the chamber can shape its box before the image loads."""

    width: float
    height: float


class SectionOut(Schema):
    """One of the PDF's bookmarks. `page` is zero-based."""

    title: str
    page: int
    depth: int


class PageLayoutOut(Schema):
    """Everything the chamber needs to lay a chapter out (D73).

    Deliberately not where the page images live: those are storage paths, and a
    storage path must never reach a client (D19).
    """

    pages: list[PageSizeOut]
    sections: list[SectionOut]


class ProgressIn(Schema):
    """How far through the chapter the reader has got, 0–1 (D70)."""

    furthest: float
