"""Chapter pages as images — the PDF never leaves the server (D73).

**Rendered once, at upload**, called explicitly from the admin save, `seed_dev`
and `manage.py render_chapters` — never from a signal (D19). Each page becomes a
WebP in private storage beside the PDF, and `Chapter.page_layout` records each
page's size, where its image is, and the PDF's sections.

**Watermarked on every request** with the reader's name and masked phone, burned
into the image. A screenshot cannot be prevented by any web page; a watermark
makes one traceable, which is what discourages sharing.
"""

from __future__ import annotations

import io
import logging
import math

import pypdfium2 as pdfium
from django.core.files.base import ContentFile
from PIL import Image, ImageDraw, ImageFont
from pypdf import PdfReader

logger = logging.getLogger(__name__)

# Wide enough to stay sharp at two device pixels per CSS pixel on a reading
# column of ~700px; small enough that a text page is ~100–200 KB.
RENDER_WIDTH = 1400
WEBP_QUALITY = 80

# The watermark: ink at ~8% opacity, diagonal, tiled. Visible in a screenshot,
# invisible to someone reading.
WATERMARK_RGBA = (31, 27, 22, 22)  # the ink (D81), ~8% opacity
WATERMARK_ANGLE = 30


# ── rendering (at upload) ─────────────────────────────────────────────────


def render_and_save(chapter) -> bool:
    """Render every page, store the images, and record the layout on the chapter.

    Returns False — and leaves the chapter as it was — when the PDF cannot be
    rendered. An upload must not fail because of one bad file; the chamber
    shows its own error for a chapter with no pages (D43).
    """
    try:
        layout = _render(chapter)
    except Exception:
        logger.exception("could not render pages for chapter %s", chapter.pk)
        return False

    chapter.page_layout = layout
    chapter.save(update_fields=["page_layout"])
    return True


def _render(chapter) -> dict:
    with chapter.file.open("rb") as handle:
        data = handle.read()

    storage = chapter.file.storage
    document = pdfium.PdfDocument(data)
    pages = []
    try:
        for index in range(len(document)):
            page = document[index]
            width, height = page.get_size()
            image = page.render(scale=RENDER_WIDTH / width).to_pil().convert("RGB")

            buffer = io.BytesIO()
            image.save(buffer, "WEBP", quality=WEBP_QUALITY, method=4)

            path = _image_path(chapter, index)
            if storage.exists(path):
                storage.delete(path)
            stored = storage.save(path, ContentFile(buffer.getvalue()))

            pages.append({"width": round(width, 2), "height": round(height, 2), "image": stored})
    finally:
        document.close()

    return {"pages": pages, "sections": _sections(data)}


def _image_path(chapter, index: int) -> str:
    return f"pages/{chapter.book.slug}/{chapter.pk}/{index + 1:04d}.webp"


def _sections(data: bytes) -> list[dict]:
    """The PDF's bookmarks, flattened, each with a zero-based page.

    Entries that do not resolve to a page (external links, broken bookmarks)
    are dropped rather than shown pointing nowhere. No heading detection: a
    guessed table of contents is a wrong one (D71's reasoning, kept by D73).
    """
    try:
        reader = PdfReader(io.BytesIO(data))
        outline = reader.outline
    except Exception:
        return []

    sections: list[dict] = []

    def walk(items, depth: int) -> None:
        for item in items:
            if isinstance(item, list):
                walk(item, depth + 1)
                continue
            try:
                page = reader.get_destination_page_number(item)
            except Exception:
                continue
            title = (getattr(item, "title", "") or "").strip()
            if title and page is not None and page >= 0:
                sections.append({"title": title, "page": page, "depth": depth})

    walk(outline, 0)
    return sections


# ── serving (per request) ─────────────────────────────────────────────────


def layout_for(chapter) -> dict | None:
    """What the reader needs to lay the chapter out — without where images live."""
    layout = chapter.page_layout
    if not layout or not layout.get("pages"):
        return None
    return {
        "pages": [{"width": p["width"], "height": p["height"]} for p in layout["pages"]],
        "sections": layout.get("sections", []),
    }


def watermarked_page(chapter, index: int, mark: str) -> bytes | None:
    """Page `index` (zero-based) as WebP bytes with `mark` burned in, or None."""
    pages = (chapter.page_layout or {}).get("pages", [])
    if not 0 <= index < len(pages):
        return None

    with chapter.file.storage.open(pages[index]["image"], "rb") as handle:
        base = Image.open(handle)
        base.load()

    marked = Image.alpha_composite(base.convert("RGBA"), _watermark(base.size, mark))

    buffer = io.BytesIO()
    marked.convert("RGB").save(buffer, "WEBP", quality=WEBP_QUALITY, method=4)
    return buffer.getvalue()


def _watermark(size: tuple[int, int], mark: str) -> Image.Image:
    """A transparent layer the size of the page, with `mark` tiled diagonally."""
    width, height = size
    font = ImageFont.load_default(size=max(14, width // 48))

    # Draw rows on a square large enough to cover the page at any rotation,
    # rotate it, then cut the page-sized middle out.
    side = int(math.hypot(width, height)) + 1
    layer = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)

    left, top, right, bottom = draw.textbbox((0, 0), mark, font=font)
    step_x = (right - left) + width // 6
    step_y = (bottom - top) * 7

    for row, y in enumerate(range(0, side, step_y)):
        offset = (row % 2) * step_x // 2
        for x in range(-step_x, side, step_x):
            draw.text((x + offset, y), mark, font=font, fill=WATERMARK_RGBA)

    rotated = layer.rotate(WATERMARK_ANGLE, resample=Image.Resampling.BICUBIC)
    x0 = (side - width) // 2
    y0 = (side - height) // 2
    return rotated.crop((x0, y0, x0 + width, y0 + height))


def mark_for(user) -> str:
    """`Ada Demo · +91 ******3210` — who the page was served to, without the whole number."""
    return f"{user.full_name} · {mask_phone(user.phone)}"


def mask_phone(phone: str | None) -> str:
    """Keep the country code and the last four digits; hide the rest.

    Asterisks, not bullets: Pillow's built-in font has no bullet glyph, and a
    watermark of empty boxes names nobody.
    """
    digits = (phone or "").strip()
    if len(digits) <= 7:
        return digits
    return f"{digits[:3]} {'*' * (len(digits) - 7)}{digits[-4:]}"
