"""Grant-authenticated endpoints — the product's main path (D29).

A reader taps a WhatsApp link and lands here with no session and no cookies.
The token in the path is the whole credential.

Both endpoints are CSRF-exempt (D30): CSRF defends against *ambient* authority,
and a grant token is not ambient — it is in a URL the reader deliberately
opened. Enforcing it would break the main path entirely, because an arriving
reader has no CSRF cookie to present.
"""

from django.core.exceptions import SuspiciousOperation
from django.http import StreamingHttpResponse
from django.utils import timezone
from ninja import Router
from ninja.errors import HttpError

from ..auth import grant_auth
from ..machines.binding import dispatch_model
from ..machines.reading import reading_machine
from ..schemas.common import ChapterOut
from ..services import access, grants, whatsapp

router = Router()

# Read the file in chunks. Pulling a 10 MB PDF into memory per concurrent reader
# is how a small instance falls over, and free tier is a small instance.
CHUNK_SIZE = 8192


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
    )


def _open_or_refuse(grant):
    """Send OPEN to the reading machine and turn a refusal into a status code.

    The mapping lives here and nowhere below: no layer under the API knows what
    a 403 is (D38). `410` rather than `404` for an expired token is what tells
    the chamber to show sanctuary, which has a button, instead of the dead end
    an unowned chapter gets.
    """
    from types import SimpleNamespace

    result = dispatch_model(
        reading_machine, grant, "OPEN", deps=SimpleNamespace(**_deps()), user=grant.user
    )

    if result.ok:
        return result

    if result.refusal == "expired":
        raise HttpError(410, "expired")
    if result.refusal == "not_owner":
        raise HttpError(403, "not_owner")
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
    return ChapterOut(
        bookTitle=chapter.book.title,
        number=chapter.order_index,
        title=chapter.title,
        firstOpen=first_open,
    )


@router.get("/grants/{token}/pdf", auth=grant_auth, url_name="grant_pdf")
def grant_pdf(request, token: str):
    """Stream the chapter's bytes.

    **Nothing here generates a storage URL.** The bucket is private and stays
    private; the API is the only thing that ever reads it (D19, D23). That is
    what keeps grant tokens, the seven-day expiry, and revocation meaningful —
    a public URL would bypass all three at the infrastructure layer while this
    code still looked correct.
    """
    grant = request.auth
    _open_or_refuse(grant)

    try:
        handle = grant.chapter.file.open("rb")
    except (FileNotFoundError, ValueError, SuspiciousOperation) as exc:
        raise HttpError(404, "chapter file missing") from exc

    response = StreamingHttpResponse(
        iter(lambda: handle.read(CHUNK_SIZE), b""),
        content_type="application/pdf",
    )
    response["Content-Disposition"] = 'inline; filename="chapter.pdf"'
    # A chapter is a credential-gated document; no shared cache may keep it.
    response["Cache-Control"] = "private, no-store"
    return response
