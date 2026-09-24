"""How a file from the in-app admin reaches storage (D85).

Three steps, for every file:

1. **start** — the admin says what the file is and where it goes. We check its
   type and size, choose a fresh storage key, and hand back a **signed ticket**
   plus how to send the bytes.
2. **send** — the browser sends the bytes. With R2 that is **straight to R2** on
   presigned URLs (one PUT, or one per part above the multipart threshold), so
   Django never holds a large body. Without R2 (a fresh clone, tests) the bytes
   come to `direct()` instead: same steps, same screens (mandate 6).
3. **complete** — we check the object is there at the size promised, then
   `catalog.attach` puts it where it belongs.

**Why a signed ticket and not a table.** A pending upload is a promise from us to
ourselves: "this key, this size, this destination, until this time". Signing it
keeps that promise tamper-proof without a row to create, expire and clean up.
The ticket is not a read credential and exposes nothing (mandate 3), but it is
still never logged (D22).
"""

from __future__ import annotations

import math
import tempfile
import uuid
from dataclasses import dataclass

from django.conf import settings
from django.core import signing
from django.core.files import File
from django.core.files.storage import default_storage

SALT = "sapien.uploads"

# What can be uploaded, and where it may go. `kind` decides the checks.
KINDS = {
    "pdf": {"extensions": {"pdf"}, "max_mb": lambda: settings.PDF_MAX_MB, "type": "application/pdf"},
    "video": {"extensions": {"mp4"}, "max_mb": lambda: settings.VIDEO_MAX_MB, "type": "video/mp4"},
    "image": {"extensions": {"jpg", "jpeg", "png", "webp"}, "max_mb": lambda: settings.COVER_MAX_MB,
              "type": None},
}

# destination → the kind of file it takes
DESTINATIONS = {
    "new_chapter": "pdf",       # a PDF that becomes a new chapter at the end of the book
    "chapter_pdf": "pdf",       # replace a chapter's PDF
    "chapter_video": "video",
    "book_video": "video",      # D83
    "book_sample": "video",     # D76
    "book_cover": "image",
}

IMAGE_TYPES = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp"}


class UploadRefused(Exception):
    """A file we will not take, with a code the screen can put into words."""

    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


@dataclass
class Plan:
    """What `start` hands back: the ticket, and how to send the bytes."""

    ticket: str
    mode: str                      # "single" | "multipart" | "direct"
    url: str | None = None         # single
    upload_id: str | None = None   # multipart
    part_size: int | None = None
    part_urls: list[str] | None = None
    content_type: str = "application/octet-stream"


# ── helpers ─────────────────────────────────────────────────────────────────


def _extension(filename: str) -> str:
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


def _is_r2() -> bool:
    return hasattr(default_storage, "bucket_name")


def _client():
    return default_storage.connection.meta.client


def _key_for(destination: str, book, chapter, ext: str) -> str:
    """A fresh storage key. The same shapes as the models' upload paths."""
    token = uuid.uuid4()
    if destination in ("new_chapter", "chapter_pdf"):
        return f"chapters/{book.slug}/upload-{token}.pdf"
    if destination == "chapter_video":
        return f"videos/{book.slug}/{chapter.order_index}-{token}.mp4"
    if destination == "book_video":
        return f"book-videos/{book.slug}-{token}.mp4"
    if destination == "book_sample":
        return f"samples/{book.slug}-{token}.mp4"
    return f"covers/{book.slug}-{token}.{ext}"


# ── 1. start ────────────────────────────────────────────────────────────────


def start(*, destination: str, book, chapter, filename: str, size: int, title: str = "") -> Plan:
    """Check the file, choose a key, and say how to send it."""
    kind_name = DESTINATIONS.get(destination)
    if kind_name is None:
        raise UploadRefused("unknown_destination")
    kind = KINDS[kind_name]

    ext = _extension(filename)
    if ext not in kind["extensions"]:
        raise UploadRefused(f"not_{kind_name}")
    if size <= 0:
        raise UploadRefused("empty_file")
    if size > kind["max_mb"]() * 1024 * 1024:
        raise UploadRefused(f"{kind_name}_too_large")

    content_type = kind["type"] or IMAGE_TYPES[ext]
    key = _key_for(destination, book, chapter, ext)
    claims = {
        "d": destination,
        "b": book.pk,
        "c": chapter.pk if chapter is not None else None,
        "k": key,
        "s": size,
        "t": (title or "").strip()[:300],
        "ct": content_type,
    }

    if not _is_r2():
        return Plan(ticket=_sign(claims), mode="direct", content_type=content_type)

    client = _client()
    bucket = default_storage.bucket_name
    ttl = settings.UPLOAD_URL_TTL_SECONDS

    if size <= settings.UPLOAD_MULTIPART_THRESHOLD_MB * 1024 * 1024:
        url = client.generate_presigned_url(
            "put_object",
            Params={"Bucket": bucket, "Key": key, "ContentType": content_type},
            ExpiresIn=ttl,
        )
        return Plan(ticket=_sign(claims), mode="single", url=url, content_type=content_type)

    part_size = settings.UPLOAD_PART_MB * 1024 * 1024
    upload = client.create_multipart_upload(Bucket=bucket, Key=key, ContentType=content_type)
    upload_id = upload["UploadId"]
    part_urls = [
        client.generate_presigned_url(
            "upload_part",
            Params={"Bucket": bucket, "Key": key, "UploadId": upload_id, "PartNumber": n},
            ExpiresIn=ttl,
        )
        for n in range(1, math.ceil(size / part_size) + 1)
    ]
    claims["u"] = upload_id
    return Plan(ticket=_sign(claims), mode="multipart", upload_id=upload_id,
                part_size=part_size, part_urls=part_urls, content_type=content_type)


def _sign(claims: dict) -> str:
    return signing.dumps(claims, salt=SALT, compress=True)


def read_ticket(ticket: str) -> dict:
    try:
        return signing.loads(ticket, salt=SALT, max_age=settings.UPLOAD_URL_TTL_SECONDS)
    except signing.SignatureExpired as exc:
        raise UploadRefused("ticket_expired") from exc
    except signing.BadSignature as exc:
        raise UploadRefused("bad_ticket") from exc


# ── 2. send, without R2 ─────────────────────────────────────────────────────


def direct(ticket: str, stream) -> None:
    """The no-R2 fallback: the bytes come through the API (mandate 6).

    Spooled to a temporary file rather than held in memory, and refused if the
    body is not the size the ticket promised.
    """
    claims = read_ticket(ticket)
    if _is_r2():
        raise UploadRefused("use_the_signed_url")

    with tempfile.SpooledTemporaryFile(max_size=8 * 1024 * 1024) as spool:
        written = 0
        while chunk := stream.read(1024 * 1024):
            written += len(chunk)
            if written > claims["s"]:
                raise UploadRefused("size_mismatch")
            spool.write(chunk)
        if written != claims["s"]:
            raise UploadRefused("size_mismatch")
        spool.seek(0)
        if not default_storage.exists(claims["k"]):
            default_storage.save(claims["k"], File(spool))


# ── 3. complete ─────────────────────────────────────────────────────────────


def complete(ticket: str, parts: list[dict] | None = None) -> dict:
    """Check the bytes arrived, and return the ticket's claims for `attach`.

    For a multipart upload this also tells R2 to stitch the parts together.
    Completing twice is harmless: the second finds the object already whole.
    """
    claims = read_ticket(ticket)
    key = claims["k"]

    if claims.get("u") and not default_storage.exists(key):
        if not parts:
            raise UploadRefused("missing_parts")
        _client().complete_multipart_upload(
            Bucket=default_storage.bucket_name,
            Key=key,
            UploadId=claims["u"],
            MultipartUpload={
                "Parts": sorted(
                    ({"ETag": p["etag"], "PartNumber": int(p["partNumber"])} for p in parts),
                    key=lambda p: p["PartNumber"],
                )
            },
        )

    if not default_storage.exists(key):
        raise UploadRefused("not_uploaded")
    if default_storage.size(key) != claims["s"]:
        raise UploadRefused("size_mismatch")
    return claims
