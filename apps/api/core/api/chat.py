"""The companion endpoint (D7, D13, D33).

**Grant-authenticated.** Chat is scoped to one chapter, and the grant is what
says which chapter and whose. A session would let a reader ask about a chapter
they had not opened.

The endpoint owns no caps and no prompt -- `services/companion.py` does (D33).
All this does is turn a refusal code into a status code (D38).
"""

import logging

from ninja import Router
from ninja.errors import HttpError

from ..auth import grant_auth
from ..schemas.common import ChatIn, ChatOut
from ..services import access, companion

router = Router()
log = logging.getLogger(__name__)

# Refusal → status. The only place that knows what a 429 is.
STATUS = {
    "message_too_long": 422,
    "grant_daily_cap": 429,
    "global_daily_cap": 429,
}


@router.post("/chat", response=ChatOut, auth=grant_auth, url_name="chat")
def chat(request, payload: ChatIn):
    grant = request.auth

    if grant.is_expired:
        raise HttpError(410, "expired")

    # A live token is never sufficient on its own (D25).
    if not access.can_read(grant.user, grant.chapter):
        raise HttpError(403, "not_owner")

    if not (grant.chapter.text_content or "").strip():
        # Nothing to talk about. Said plainly rather than letting the model
        # improvise about a chapter it cannot see.
        raise HttpError(409, "chapter_not_extracted")

    try:
        result = companion.ask(
            grant,
            payload.question,
            [],
        )
    except companion.CompanionUnavailable as exc:
        log.warning("companion unavailable: %s", exc)
        raise HttpError(503, "companion_unavailable") from exc

    if isinstance(result, companion.Refusal):
        raise HttpError(STATUS.get(result.code, 429), result.code)

    return ChatOut(answer=result.text)
