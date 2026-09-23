"""The Home payload (D11).

**No tokens here.** Home mints a grant on demand when the reader asks for a
link, rather than minting one per chapter per page load — which would spray
credentials into a response that gets logged, cached and screenshotted.
"""

from ninja import Schema


class ChapterOut(Schema):
    id: str
    number: int
    title: str
    read: bool          # opened at least once, from `opened_at`
    progress: float     # 0–1; 1 only once marked complete (D70)
    completed: bool


class BookOut(Schema):
    id: str
    title: str
    progress: float     # the mean across its chapters (D70)
    chapters: list[ChapterOut]


class HomeOut(Schema):
    books: list[BookOut]
