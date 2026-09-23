"""Acquisition actions — effects only; every decision is a guard (D59, D69).

A class, so the move to `apps/acquisition/state_machine/` is a move (D69).

**Refusal codes are the contract.** `already_owns_book` and
`partial_identity_match` reach the frontend, which renders them differently: one
has a button that resends the links, the other does not. They must never be
collapsed into a single code.
"""


class AcquisitionActions:
    def create_reader_for_phone(self, attempt, ctx):
        """TEMPORARY — `settings.ONBOARDING_ALLOW_PHONE_REUSE` (see machine.py).

        Treats the phone as the identity and reuses that reader. The new email is
        ignored rather than overwriting theirs: silently rewriting an account's
        email from a checkout form is the more dangerous half of this.
        """
        self._create(attempt, ctx, ctx.deps.find_by_phone(attempt.phone))

    def create_reader(self, attempt, ctx):
        """The only way a reader begins (D26). Three rows atomic, delivery after.

        The machine has already decided the identity case, so `user` is passed
        in: `None` for a new reader, the resolved reader for one we know. The
        seam keeps its transaction boundary and its post-commit delivery.

        `book_has_no_chapters` is raised from inside the transaction and is a
        refusal, not a crash — the book is real, it is simply not ready to sell.
        """
        self._create(attempt, ctx, ctx.deps.find_by_email(attempt.email))

    def _create(self, attempt, ctx, user):
        book = ctx.deps.book_by_slug(attempt.book_slug)

        try:
            result = ctx.deps.create_reader(
                full_name=attempt.full_name,
                email=attempt.email,
                phone=attempt.phone,
                book=book,
                pace=attempt.pace,
                user=user,
            )
        except ctx.deps.OnboardingRefused as exc:
            # The in-transaction ownership check is the race backstop: two
            # payments landing together both pass `owns_book` and only one
            # commits. Catching it here keeps that a refusal rather than a 500.
            ctx.refuse(exc.reason)
            return

        if attempt.payment_reference:
            ctx.deps.adopt_reference(result.order, attempt.payment_reference)

        ctx.produce(result)

    def adopt_reference(self, attempt, ctx):
        """Take the reference onto the existing order, so the next replay
        short-circuits on `already_fulfilled` instead of coming back here."""
        book = ctx.deps.book_by_slug(attempt.book_slug)
        order = ctx.deps.order_for(ctx.deps.find_by_email(attempt.email), book)

        if order is not None and attempt.payment_reference and not order.payment_reference:
            ctx.deps.adopt_reference(order, attempt.payment_reference)

        ctx.produce(order)

    # ── refusals ──────────────────────────────────────────────────────────
    def note_duplicate(self, attempt, ctx):
        """Already fulfilled. Nothing to do, and not an error to retry."""
        ctx.refuse("duplicate")

    def refuse_unknown_book(self, attempt, ctx):
        ctx.refuse("unknown_book")

    def refuse_already_owns(self, attempt, ctx):
        """They own it. The useful answer is the links again, not a dead end —
        which is why this is distinct from every other refusal."""
        ctx.refuse("already_owns_book")

    def refuse_two_readers(self, attempt, ctx):
        """Email says one person, phone says another."""
        ctx.refuse("identity_belongs_to_two_readers")

    def refuse_partial_match(self, attempt, ctx):
        """One field matches and the other does not.

        A changed phone number and a typo'd phone number are identical to the
        code, and guessing wrong is expensive both ways: updating silently sends
        chapter links to a stranger's phone, and creating a second account loses
        the reader the book they paid for. An admin can tell in two seconds.
        """
        ctx.refuse("partial_identity_match")


actions = AcquisitionActions()
