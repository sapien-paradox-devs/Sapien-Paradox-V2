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
    read: bool          # a quiet mark, from `opened_at` — not a progress bar


class BookOut(Schema):
    id: str
    title: str
    chapters: list[ChapterOut]


class HomeOut(Schema):
    books: list[BookOut]
