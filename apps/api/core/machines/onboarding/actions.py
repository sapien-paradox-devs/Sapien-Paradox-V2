"""Onboarding actions."""


def create_reader(attempt, ctx):
    """The only way a reader begins (D26). Three rows atomic, delivery after."""
    ctx.produce(
        ctx.deps.create_reader(
            full_name=ctx.payload.full_name,
            email=ctx.payload.email,
            phone=ctx.payload.phone,
            book=ctx.payload.book,
            pace=ctx.payload.pace,
        )
    )


def add_order(attempt, ctx):
    """A reader we already know, buying another book."""
    ctx.produce(
        ctx.deps.add_order(
            user=ctx.deps.find_by_email(ctx.payload.email),
            book=ctx.payload.book,
            pace=ctx.payload.pace,
        )
    )


def refuse_duplicate_order(attempt, ctx):
    """They already own this book — a double charge, or a slip."""
    ctx.refuse("duplicate_order")


def refuse_identity_conflict(attempt, ctx):
    """One field matches and the other does not, or they match two readers.

    A changed phone number and a typo'd phone number are identical to the code,
    and guessing wrong is expensive both ways: updating silently sends chapter
    links to a stranger's phone, and creating a second account loses the reader
    the book they paid for. An admin can tell in two seconds; the code cannot.
    """
    ctx.refuse("identity_conflict")
