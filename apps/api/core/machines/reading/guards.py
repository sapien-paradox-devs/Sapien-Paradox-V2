"""Reading guards. Individual named predicates — one question each."""


def is_due(grant, ctx):
    """Has this chapter's unlock moment passed?

    `unlock_at` is null until cadence lands (D21), and a grant with no unlock
    moment is due immediately.
    """
    return grant.unlock_at is None or ctx.deps.now() >= grant.unlock_at


def is_live(grant, ctx):
    """Is the token still within its seven days (D8)?"""
    return ctx.deps.now() < grant.expires_at


def is_past_expiry(grant, ctx):
    return not is_live(grant, ctx)


def owns_book(grant, ctx):
    """Does the reader still own the book?

    A live token is never sufficient on its own (D25) — ownership is re-checked
    on every request, so a refund takes effect on the next one.
    """
    return ctx.deps.can_read(grant.user, grant.chapter)
