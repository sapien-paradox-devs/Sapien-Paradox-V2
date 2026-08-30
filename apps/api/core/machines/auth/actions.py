"""Auth actions."""


def open_session(session, ctx):
    user = ctx.deps.authenticate(ctx.payload.email, ctx.payload.password)
    ctx.deps.login(user)
    ctx.produce(user)


def close_session(session, ctx):
    ctx.deps.logout()


def send_reset(session, ctx):
    user = ctx.deps.find_by_phone(ctx.payload.phone)
    token = ctx.deps.mint_reset_token(user)
    ctx.produce(ctx.deps.send_password_reset(token))


def say_nothing(session, ctx):
    """An unknown phone gets the same answer a known one does.

    Reporting "no such number" would turn this endpoint into a way to find out
    who has an account.
    """


def set_password(session, ctx):
    token = ctx.deps.find_live_reset_token(ctx.payload.token)
    user = ctx.deps.set_password(token.user, ctx.payload.password)
    ctx.deps.consume_reset_token(token)
    ctx.deps.login(user)
    ctx.produce(user)


def refuse_bad_credentials(session, ctx):
    ctx.refuse("bad_credentials")


def refuse_bad_reset_token(session, ctx):
    ctx.refuse("reset_token_invalid")
