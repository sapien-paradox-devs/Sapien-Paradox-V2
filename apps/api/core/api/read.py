"""Session-authenticated reading and delivery (D11).

Three endpoints the SPA needs and the grant path does not: they all identify the
reader by cookie, because the reader is already on Home when they use them.

Rate limits are counted from `MessageLog` rows in a window (D31). There is no
counter and no Redis -- the rows already exist, and a counter would be a second
source of truth that can disagree with them.
"""

from datetime import timedelta

from django.conf import settings
from django.shortcuts import get_object_or_404
from django.utils import timezone
from ninja import Router
from ninja.errors import HttpError

from ..auth import grant_auth, session_auth
from ..models import Chapter, MessageLog
from ..services import access, grants, whatsapp

router = Router()


# Moved to services/whatsapp.py — the post-checkout resend needs it too.
_recently_sent = whatsapp.recently_sent


@router.get("/read/{chapter_id}", auth=session_auth, url_name="read_chapter")
def read_chapter(request, chapter_id: str):
    """Exchange a chapter for a link to read it.

    **A GET, and idempotent** (D32). `mint_or_reuse` hands back a live grant if
    one exists, so opening the same chapter twice does not accumulate tokens.
    Making it a POST would put an interstitial screen on the path to reading,
    which is the one path that should never have one.
    """
    chapter = get_object_or_404(Chapter, pk=chapter_id)

    # A live token is never sufficient on its own, and neither is a session:
    # ownership is re-checked here so a refund takes effect on the next request.
    if not access.can_read(request.auth, chapter):
        raise HttpError(403, "not_owner")

    grant = grants.mint_or_reuse(request.auth, chapter)
    return {"token": grant.token}


@router.post("/chapters/{chapter_id}/send", auth=session_auth, url_name="send_chapter")
def send_chapter(request, chapter_id: str):
    """Send this chapter to my own WhatsApp (D11).

    **Reuses** a live grant rather than minting one. Otherwise every press of the
    button spawns a token, and a reader tapping twice would leave two live links
    for one chapter (D27).
    """
    chapter = get_object_or_404(Chapter, pk=chapter_id)

    if not access.can_read(request.auth, chapter):
        raise HttpError(403, "not_owner")

    if _recently_sent(request.auth, "chapter_delivery",
                      settings.CHAPTER_SEND_COOLDOWN_MINUTES):
        # The frontend renders 429 as "already sent — check WhatsApp", not as an
        # error, because that is what it is (D45).
        raise HttpError(429, "already_sent")

    grant = grants.mint_or_reuse(request.auth, chapter)
    log = whatsapp.send_chapter(grant)

    if log.status != "sent":
        raise HttpError(502, "delivery_failed")

    return {"ok": True}


@router.post("/grants/{token}/reissue", auth=grant_auth, url_name="reissue")
def reissue(request, token: str):
    """Sanctuary's one tap: a dead link becomes a live one (D9).

    **Grant-authenticated, and works on an EXPIRED token** — that is the entire
    point. `GrantAuth` resolves the token without judging expiry, which is what
    makes this reachable at all.

    The fresh link goes to the *owner's* phone, never to whoever tapped, so a
    forwarded expired link leaks no access.
    """
    grant = request.auth

    if not access.can_read(grant.user, grant.chapter):
        raise HttpError(403, "not_owner")

    if _recently_sent(grant.user, "fresh_link", settings.REISSUE_COOLDOWN_MINUTES):
        raise HttpError(429, "already_sent")

    fresh = grants.reissue(grant)
    log = whatsapp.send_fresh_link(fresh)

    if log.status != "sent":
        raise HttpError(502, "delivery_failed")

    return {"ok": True}
