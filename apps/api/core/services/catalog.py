"""Books and chapters, as the in-app admin builds them (D82–D86).

Everything the book workspace can do is a function here; `api/admin_books.py`
only maps HTTP to these calls. A management command or a script can do the same
things through the same functions.

**Two rules that protect readers** (D84):

- A book is created **unpublished**, and is published only when its checklist
  passes: at least one chapter, every chapter rendered, a cover.
- Once a book is published, **chapter order is fixed**, and a chapter that
  anyone has a grant for cannot be deleted. Grants, progress and cadence all
  point at chapters by position.
"""

from __future__ import annotations

from dataclasses import dataclass

from django.db import transaction
from django.utils.text import slugify

from ..models import Book, Chapter, TemporalGrant
from . import extraction, pages


class CatalogRefused(Exception):
    """A change we will not make, with a code and, when it belongs to one, a field."""

    def __init__(self, code: str, field: str | None = None):
        super().__init__(code)
        self.code = code
        self.field = field


@dataclass
class Checklist:
    has_chapters: bool
    all_ready: bool
    has_cover: bool

    @property
    def passes(self) -> bool:
        return self.has_chapters and self.all_ready and self.has_cover


# ── books ───────────────────────────────────────────────────────────────────


def _unique_slug(title: str, exclude_pk=None) -> str:
    base = slugify(title)[:40] or "book"
    slug, n = base, 2
    while Book.objects.filter(slug=slug).exclude(pk=exclude_pk).exists():
        slug, n = f"{base}-{n}", n + 1
    return slug


def create_book(*, title: str, author: str = "", description: str = "", price_minor_units: int = 0) -> Book:
    """A new, unpublished book (D84). It exists from this moment; the workspace fills it."""
    title = (title or "").strip()
    if not title:
        raise CatalogRefused("title_required", "title")
    if price_minor_units < 0:
        raise CatalogRefused("price_negative", "priceMinorUnits")
    return Book.objects.create(
        title=title,
        slug=_unique_slug(title),
        author=(author or "").strip(),
        description=(description or "").strip(),
        price_cents=price_minor_units,
        is_published=False,
    )


def update_book(book: Book, *, title=None, author=None, description=None, price_minor_units=None) -> Book:
    """Edit the details. The slug stays: it is in links already shared."""
    if title is not None:
        if not title.strip():
            raise CatalogRefused("title_required", "title")
        book.title = title.strip()
    if author is not None:
        book.author = author.strip()
    if description is not None:
        book.description = description.strip()
    if price_minor_units is not None:
        if price_minor_units < 0:
            raise CatalogRefused("price_negative", "priceMinorUnits")
        book.price_cents = price_minor_units
    book.save()
    return book


def checklist(book: Book) -> Checklist:
    chapters = list(book.chapters.all())
    return Checklist(
        has_chapters=bool(chapters),
        all_ready=bool(chapters) and all(c.page_layout for c in chapters),
        has_cover=bool(book.cover),
    )


def publish(book: Book) -> Book:
    if not checklist(book).passes:
        raise CatalogRefused("checklist_incomplete")
    book.is_published = True
    book.save(update_fields=["is_published"])
    return book


def unpublish(book: Book) -> Book:
    """Off sale. Readers who already own it keep reading: access is `Order`, not this flag."""
    book.is_published = False
    book.save(update_fields=["is_published"])
    return book


MEDIA_FIELDS = {"cover": "cover", "sample": "sample_video"}


def remove_book_media(book: Book, which: str) -> Book:
    field = MEDIA_FIELDS.get(which)
    if field is None:
        raise CatalogRefused("unknown_media")
    if which == "cover" and book.is_published:
        # The checklist asks for a cover; a published book keeps one. Replace it instead.
        raise CatalogRefused("published_needs_cover")
    setattr(book, field, "")
    book.save(update_fields=[field])
    return book


# ── chapters ────────────────────────────────────────────────────────────────


def rename_chapter(chapter: Chapter, title: str) -> Chapter:
    if not (title or "").strip():
        raise CatalogRefused("title_required", "title")
    chapter.title = title.strip()
    chapter.save(update_fields=["title"])
    return chapter


def reorder_chapters(book: Book, chapter_ids: list[int]) -> None:
    """Set the order of a draft book's chapters (D84).

    Two passes inside one transaction, because `(book, order_index)` is unique:
    moving everything out of the way first means no intermediate state collides.
    """
    if book.is_published:
        raise CatalogRefused("published_order_fixed")
    current = list(book.chapters.values_list("pk", flat=True))
    if sorted(current) != sorted(chapter_ids):
        raise CatalogRefused("order_mismatch")

    with transaction.atomic():
        offset = len(current) + 1000
        for pk in current:
            Chapter.objects.filter(pk=pk).update(order_index=offset + pk)
        for index, pk in enumerate(chapter_ids, start=1):
            Chapter.objects.filter(pk=pk).update(order_index=index)


def delete_chapter(chapter: Chapter) -> None:
    """Only while the book is a draft, and never once someone has a link to it (D84)."""
    if chapter.book.is_published:
        raise CatalogRefused("published_chapter_fixed")
    if TemporalGrant.objects.filter(chapter=chapter).exists():
        raise CatalogRefused("chapter_has_readers")

    book = chapter.book
    with transaction.atomic():
        chapter.delete()
        remaining = list(book.chapters.order_by("order_index").values_list("pk", flat=True))
        # Close the gap, through the same collision-free path as a reorder.
        offset = len(remaining) + 1000
        for pk in remaining:
            Chapter.objects.filter(pk=pk).update(order_index=offset + pk)
        for index, pk in enumerate(remaining, start=1):
            Chapter.objects.filter(pk=pk).update(order_index=index)


def remove_chapter_video(chapter: Chapter) -> Chapter:
    chapter.video = ""
    chapter.save(update_fields=["video"])
    return chapter


def prepare(chapter: Chapter) -> bool:
    """Extract the text and render the pages (D73). True when the chapter is ready.

    One chapter per request, which is what keeps a 20-chapter folder inside the
    host's request time: twenty small jobs, not one large one (D85).
    """
    extraction.extract_and_save(chapter)
    return pages.render_and_save(chapter)
