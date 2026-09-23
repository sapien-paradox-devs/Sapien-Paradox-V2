"""A book's public media: its cover and its sample video (D76, D77).

Public, like `GET /api/books`: a visitor browsing the catalogue has no session
and no grant. Published books only, so an unfinished book's cover or sample is
not reachable by guessing its slug.
"""

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from ninja import Router
from ninja.errors import HttpError

from ..models import Book
from ..schemas.common import VideoOut
from ..services import media

router = Router()


def _published(slug: str) -> Book:
    return get_object_or_404(Book, slug=slug, is_published=True)


@router.get("/books/{slug}/cover", auth=None, url_name="book_cover")
def book_cover(request, slug: str):
    """The cover image, proxied (mandate 3). Cacheable: it is public and changes
    only when re-uploaded, which gives it a new storage name."""
    found = media.cover_bytes(_published(slug))
    if found is None:
        raise HttpError(404, "no_cover")

    data, content_type = found
    response = HttpResponse(data, content_type=content_type)
    response["Cache-Control"] = "public, max-age=3600"
    response["X-Content-Type-Options"] = "nosniff"
    return response


@router.get("/books/{slug}/sample", response=VideoOut, auth=None, url_name="book_sample")
def book_sample(request, slug: str):
    """The public sample, as a short-lived signed URL (D77). The bucket stays
    private; "public" means anyone may ask for a URL."""
    url = media.sample_video_url(_published(slug))
    if url is None:
        raise HttpError(404, "no_sample")
    return VideoOut(url=url)
