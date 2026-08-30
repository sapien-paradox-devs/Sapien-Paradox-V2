"""Auth guards."""


def credentials_valid(session, ctx):
    return ctx.deps.authenticate(ctx.payload.email, ctx.payload.password) is not None


def phone_known(session, ctx):
    return ctx.deps.find_by_phone(ctx.payload.phone) is not None


def under_rate_limit(session, ctx):
    """Counted from PasswordResetToken rows in a window, not a counter (D31)."""
    return ctx.deps.reset_requests_in_window(ctx.payload.phone) < ctx.deps.reset_limit


def reset_token_live(session, ctx):
    """Single-use, about an hour (D21)."""
    return ctx.deps.find_live_reset_token(ctx.payload.token) is not None
