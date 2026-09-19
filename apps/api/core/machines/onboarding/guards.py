"""Onboarding guards — D26's four identity cases, one question each.

`email` and `phone` are both unique (D19), so a submission matches zero, one or
two existing readers, and which it is decides everything.
"""


def _by_email(ctx):
    return ctx.deps.find_by_email(ctx.payload.email)


def _by_phone(ctx):
    return ctx.deps.find_by_phone(ctx.payload.phone)


def identity_unknown(attempt, ctx):
    """Neither field is taken — a genuinely new reader."""
    return _by_email(ctx) is None and _by_phone(ctx) is None


def is_exact_match(attempt, ctx):
    """Both fields point at the same existing reader.

    A returning reader buying a second book is a normal event, not an error
    (D26) — `Order` is unique per (user, book), not per user.
    """
    by_email, by_phone = _by_email(ctx), _by_phone(ctx)
    return by_email is not None and by_email == by_phone


def already_owns_book(attempt, ctx):
    return ctx.deps.owns_book(_by_email(ctx), ctx.payload.book)
