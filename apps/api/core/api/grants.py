"""Grant-authenticated endpoints — the product's main path (D29).

A reader taps a WhatsApp link and lands here with no session and no cookies.
The token in the path is the whole credential.

Both endpoints are CSRF-exempt (D30): CSRF defends against *ambient* authority,
and a grant token is not ambient — it is in a URL the reader deliberately
opened. Enforcing it would break the main path entirely, because an arriving
reader has no CSRF cookie to present.
"""

from django.http import HttpResponse
from django.utils import timezone
from ninja import Router
from ninja.errors import HttpError

from ..auth import grant_auth
from ..machines.binding import dispatch_model
from ..machines.reading import reading_machine
from ..schemas.common import ChapterOut, PageLayoutOut, ProgressIn, VideoOut
from .. import selectors
from ..services import access, grants, media, pages, progress, whatsapp

router = Router()


def _deps():
    """What the reading machine's guards and actions are handed (D37).

    The machine imports no Django; everything it needs arrives here as plain
    callables, which is also why its tests run with no database.
    """
    return dict(
        now=timezone.now,
        can_read=access.can_read,
        send_chapter=whatsapp.send_chapter,
        mint_grant=grants.mint_or_reuse,
        record_progress=progress.record,
        complete_chapter=progress.complete,
        video_url=media.chapter_video_url,
    )


def _open_or_refuse(grant):
    """Send OPEN to the reading machine — see `_dispatch_or_refuse`."""
    return _dispatch_or_refuse(grant, "OPEN")


def _dispatch_or_refuse(grant, event: str, **payload):
    """Send `event` to the reading machine and turn a refusal into a status code.

    The mapping lives here and nowhere below: no layer under the API knows what
    a 403 is (D38). `410` rather than `404` for an expired token is what tells
    the chamber to show sanctuary, which has a button, instead of the dead end
    an unowned chapter gets.
    """
    from types import SimpleNamespace

    result = dispatch_model(
        reading_machine, grant, event, deps=SimpleNamespace(**_deps()), user=grant.user, **payload
    )

    if result.ok:
        return result

    if result.refusal == "expired":
        raise HttpError(410, "expired")
    if result.refusal == "not_owner":
        raise HttpError(403, "not_owner")
    if result.refusal == "no_video":
        raise HttpError(404, "no_video")
    raise HttpError(403, result.refusal or "refused")


@router.get("/grants/{token}", response=ChapterOut, auth=grant_auth, url_name="grant_detail")
def grant_detail(request, token: str):
    """Validate the token and return what the chamber needs to render.

    `opened_at` is stamped by the machine, and only on the FIRST open — it is an
    engagement signal, not analytics (D21). Re-opening within the seven days is
    ordinary and must not restamp it. `firstOpen` reports which of the two this
    request was, so the chamber can play its ceremony exactly once (#116).
    """
    grant = request.auth          # GrantAuth returned the grant, or None → 401
    # Read before OPEN, which stamps it. The chamber only fetches the PDF after
    # this response, so the PDF request cannot stamp it first.
    first_open = grant.opened_at is None
    _open_or_refuse(grant)

    chapter = grant.chapter
    place = selectors.progress_for(grant.user, chapter)
    return ChapterOut(
        bookTitle=chapter.book.title,
        number=chapter.order_index,
        title=chapter.title,
        firstOpen=first_open,
        furthest=place.furthest,
        completed=place.completed,
        hasVideo=bool(chapter.video),
    )


@router.get("/grants/{token}/pages", response=PageLayoutOut, auth=grant_auth, url_name="grant_pages")
def grant_pages(request, token: str):
    """The chapter's shape: each page's size and its sections (D73).

    **There is no PDF endpoint.** The file never leaves the server; the chamber
    is built from this layout and one image per page. 404 when the chapter has
    not been rendered — the chamber shows its own error for that (D43).
    """
    grant = request.auth
    _open_or_refuse(grant)

    layout = pages.layout_for(grant.chapter)
    if layout is None:
        raise HttpError(404, "pages not ready")
    return layout


@router.get("/grants/{token}/pages/{number}", auth=grant_auth, url_name="grant_page")
def grant_page(request, token: str, number: int):
    """One page, as an image, watermarked for this reader (D73). `number` is 1-based.

    **Nothing here generates a storage URL.** The bucket is private and stays
    private; the API is the only thing that ever reads it (D19, D23). The image is
    burned with the reader's name and masked phone on every request, so a copy
    carries where it came from.
    """
    grant = request.auth
    _open_or_refuse(grant)

    image = pages.watermarked_page(grant.chapter, number - 1, pages.mark_for(grant.user))
    if image is None:
        raise HttpError(404, "no such page")

    response = HttpResponse(image, content_type="image/webp")
    response["Content-Disposition"] = "inline"
    # A chapter is a credential-gated document; no cache may keep a copy.
    response["Cache-Control"] = "private, no-store"
    response["X-Content-Type-Options"] = "nosniff"
    return response


@router.post("/grants/{token}/progress", auth=grant_auth, response={204: None}, url_name="grant_progress")
def grant_progress(request, token: str, payload: ProgressIn):
    """The reader has got this far (D70). Idempotent; only ever moves forward.

    Keyed on the reader and the chapter, not this grant, so a re-issued link
    keeps its place. CSRF-exempt like every grant endpoint (D30).
    """
    _dispatch_or_refuse(request.auth, "RECORD_PROGRESS", furthest=payload.furthest)
    return 204, None


@router.post("/grants/{token}/complete", auth=grant_auth, response={204: None}, url_name="grant_complete")
def grant_complete(request, token: str):
    """The reader marks the chapter complete — the only way to 100% (D70)."""
    _dispatch_or_refuse(request.auth, "COMPLETE")
    return 204, None


@router.get("/grants/{token}/video", response=VideoOut, auth=grant_auth, url_name="grant_video")
def grant_video(request, token: str):
    """The chapter's companion video, as a short-lived signed URL (D76, D77).

    The one place a storage URL reaches a client, and only behind the same gate
    as the pages: `WATCH` on the reading machine checks the token is live and
    the book still owned. 404 when the chapter has no video.
    """
    result = _dispatch_or_refuse(request.auth, "WATCH")
    return VideoOut(url=result.data)
