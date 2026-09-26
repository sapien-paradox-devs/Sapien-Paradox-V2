"""Reading guards. Individual named predicates — one question each."""


def is_due(grant, ctx):
    """Has this chapter's unlock moment passed?

    A grant with no unlock moment is due immediately.
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


def still_owns(grant, ctx):
    """Does the reader still own the book, for a chapter not yet unlocked?

    `owns_book` asks `can_read`, which by design says no to a chapter that is
    still scheduled, and UNLOCK's chapter always is. So this asks only the
    ownership half (D25). A deactivated reader (D80) is sent nothing more.
    """
    return ctx.deps.owns(grant.user, grant.chapter.book)


def has_video(grant, ctx):
    """Does this chapter come with a video (D76)?"""
    return bool(grant.chapter.video)
