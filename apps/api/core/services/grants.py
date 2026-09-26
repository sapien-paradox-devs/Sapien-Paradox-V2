"""Minting, validating and re-issuing grants.

Callers mint; `whatsapp.send_chapter` delivers (D27). Home reuses a live grant
so a button press does not spawn a token each time; sanctuary mints a fresh one
so the dead link stays dead. That decision belongs to the caller, which is why
these are separate functions rather than one with a `force_new` flag.
"""

from django.utils import timezone

from ..models import TemporalGrant


def validate(token: str) -> TemporalGrant | None:
    """Is this token live? Returns the grant, or None.

    **A live token is never sufficient on its own** (D25). Callers still check
    `access.can_read`, so revocation takes effect on the next request.
    """
    grant = (
        TemporalGrant.objects.select_related("user", "chapter__book")
        .filter(token=token)
        .first()
    )

    if grant is None or grant.is_expired:
        return None

    return grant


def mint_or_reuse(user, chapter) -> TemporalGrant:
    """The newest unexpired grant for this reader and chapter, or a new one.

    Idempotent by design (D32): `GET /api/read/{id}` calls this, and a reader
    who opens the same chapter twice should not accumulate tokens.
    """
    live = (
        TemporalGrant.objects.filter(
            user=user, chapter=chapter, expires_at__gt=timezone.now()
        )
        # A scheduled row holds a token nobody has been sent. Only the tick
        # may make it live (D39, D50); `can_read` refuses before we get here.
        .exclude(state=TemporalGrant.SCHEDULED)
        .order_by("-created_at")
        .first()
    )

    return live or TemporalGrant.objects.create(user=user, chapter=chapter)


def reissue(grant: TemporalGrant) -> TemporalGrant:
    """A fresh grant for the same chapter. The old token stays dead.

    Mints a **new row** rather than extending `expires_at` in place. Extending
    would silently revive access for anyone holding a forwarded expired link —
    exactly the case seven-day expiry exists for. `(user, chapter)` is
    deliberately not unique so this is possible (D21).
    """
    return TemporalGrant.objects.create(user=grant.user, chapter=grant.chapter)


def first_chapter_of(book):
    return book.chapters.order_by("order_index").first()


def find(token: str) -> TemporalGrant | None:
    """The grant for this token, live or not — or None if no such token.

    `validate` collapses "expired" into None, which is right for callers that
    only want a usable grant. The API layer needs the distinction: an expired
    link gets sanctuary and a button (D9); an unknown one gets nothing. So the
    endpoint resolves with this and lets the reading machine judge expiry.
    """
    return (
        TemporalGrant.objects.select_related("user", "chapter__book")
        .filter(token=token)
        .first()
    )
