"""Reading actions. Effects only — every decision is a guard."""

from ..binding import touched


def deliver_chapter(grant, ctx):
    """Send the chapter, and refuse if the send did not land.

    `send_chapter` returns a MessageLog and never raises (D27), so this reads
    the outcome rather than catching. A refusal is not persisted, which leaves
    the grant where it was for the next tick to retry — the failed send is the
    absence of a transition (D40).
    """
    log = ctx.deps.send_chapter(grant)
    ctx.produce(log)

    if log.status != "sent":
        ctx.refuse("delivery_failed")


def stamp_opened(grant, ctx):
    """Record the FIRST open only. Last-open would be analytics (D21)."""
    if grant.opened_at is None:
        grant.opened_at = ctx.deps.now()
        touched(grant, "opened_at")


def mint_fresh_grant(grant, ctx):
    """One tap from a dead link to a live one (D9).

    Mints a NEW row rather than extending this one. Extending in place would
    keep the old forwarded token valid, which is the whole reason
    `(user, chapter)` is not unique (D21).
    """
    fresh = ctx.deps.mint_grant(grant.user, grant.chapter)
    ctx.produce(fresh)


def refuse_expired(grant, ctx):
    """Sanctuary — the link has rested, and one tap fixes it."""
    ctx.refuse("expired")


def refuse_not_owner(grant, ctx):
    """A 403 with no button that helps. Kept distinct from `expired` (D25)."""
    ctx.refuse("not_owner")
