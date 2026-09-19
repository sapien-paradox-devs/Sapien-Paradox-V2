"""PDF → text, for the companion to read from.

**Called explicitly — never from a `post_save` signal** (D19). A hidden 40-page
parse behind an innocuous `.save()` is a surprise found in production, and the
admin save is the only place a chapter's file changes.

`page_count` is free: the file is already being parsed, and the reader needs the
number for page controls without re-parsing on every open.
"""

import logging
from dataclasses import dataclass

from pypdf import PdfReader

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Extraction:
    text: str
    page_count: int
    ok: bool
    """False when the file could not be read. The chapter is still usable."""


def extract(chapter) -> Extraction:
    """Read `chapter.file` and return its text and page count.

    A PDF we cannot parse must not take the caller down. A chapter with no
    extracted text still streams to the reader perfectly well — only the
    companion is diminished, and that is a far smaller failure than a book
    that cannot be uploaded.
    """
    try:
        with chapter.file.open("rb") as handle:
            reader = PdfReader(handle)
            pages = [page.extract_text() or "" for page in reader.pages]
    except Exception:
        logger.exception("could not extract text from chapter %s", chapter.pk)
        return Extraction(text="", page_count=0, ok=False)

    return Extraction(
        text="\n\n".join(pages).strip(),
        page_count=len(pages),
        ok=True,
    )


def extract_and_save(chapter) -> Extraction:
    """Extract, then persist onto the chapter. Returns what was found."""
    result = extract(chapter)

    chapter.text_content = result.text
    chapter.page_count = result.page_count
    chapter.save(update_fields=["text_content", "page_count"])

    return result
