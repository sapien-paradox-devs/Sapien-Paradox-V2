"""Video URLs and cover bytes (D76, D77).

**Video is the one exception to "always proxy" (mandate 3).** Streaming a video
through Django holds a worker for as long as someone watches; on the free tier a
handful of viewers would starve every other request. So a video plays from a
short-lived signed URL instead. What the mandate protects still holds: nothing
permanent is exposed, the bucket stays private, and this module is the only
place that knows how a URL is made, so storage stays swappable.

**Covers are proxied**, like pages. They are small, and a cover is not worth a
second exception.

Never log a URL this module returns: it is a credential for as long as it lives
(D22).
"""

from django.conf import settings


def signed_url(field_file) -> str | None:
    """A URL the browser can play `field_file` from, valid for a while. None if empty.

    R2 (S3Storage) gives a presigned GET that expires after
    `VIDEO_URL_TTL_SECONDS`. Local storage has no signing, so it gets an
    absolute `/media/` URL — the development fallback (mandate 6).
    """
    if not field_file:
        return None

    storage = field_file.storage
    if hasattr(storage, "bucket_name"):
        return storage.url(field_file.name, expire=settings.VIDEO_URL_TTL_SECONDS)

    return f"{settings.API_BASE_URL}{storage.url(field_file.name)}"


def chapter_video_url(chapter) -> str | None:
    """Gated: callers reach this only through the reading machine's `WATCH` row."""
    return signed_url(chapter.video)


def sample_video_url(book) -> str | None:
    """Public: the sample sells the book, so any visitor may have a URL (D76)."""
    return signed_url(book.sample_video)


COVER_TYPES = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp"}


def cover_bytes(book) -> tuple[bytes, str] | None:
    """The cover image and its content type, read server-side. None if no cover."""
    if not book.cover:
        return None

    ext = book.cover.name.rsplit(".", 1)[-1].lower()
    with book.cover.open("rb") as handle:
        return handle.read(), COVER_TYPES.get(ext, "application/octet-stream")
