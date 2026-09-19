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


class ChatIn(Schema):
    """The panel's existing contract: the token identifies the chapter, and the
    question is one turn. History is not sent -- the companion is chapter-scoped
    and the chapter is the context that matters (D13)."""

    token: str
    question: str


class ChatOut(Schema):
    answer: str
