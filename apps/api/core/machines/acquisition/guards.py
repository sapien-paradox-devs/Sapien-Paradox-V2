"""Acquisition guards — one question each (D59, D69).

Written as a **class** so the move to `apps/acquisition/state_machine/` is a
move and not a rewrite (D69). The instance holds no state; `guards` at the
bottom is what the transition table references.

`email` and `phone` are both unique (D19), so a submission matches zero, one or
two existing readers — and which it is decides everything (D26).
"""


class AcquisitionGuards:
    # ── identity ──────────────────────────────────────────────────────────
    def _by_email(self, attempt, ctx):
        return ctx.deps.find_by_email(attempt.email)

    def _by_phone(self, attempt, ctx):
        return ctx.deps.find_by_phone(attempt.phone)

    def identity_unknown(self, attempt, ctx):
        """Neither field is taken — a genuinely new reader (D26 case 1)."""
        return self._by_email(attempt, ctx) is None and self._by_phone(attempt, ctx) is None

    def is_exact_match(self, attempt, ctx):
        """Both fields point at the same existing reader (D26 case 2/3).

        A returning reader buying a second book is normal, not an error —
        `Order` is unique per (user, book), not per user.
        """
        by_email, by_phone = self._by_email(attempt, ctx), self._by_phone(attempt, ctx)
        return by_email is not None and by_email == by_phone

    def is_email_only_match(self, attempt, ctx):
        """Email matches an existing reader, and no phone was provided (#214).

        Without a phone there is nothing to cross-check, so email alone
        identifies. The reader keeps whatever phone they already have.
        """
        return not attempt.phone and self._by_email(attempt, ctx) is not None

    def matches_two_readers(self, attempt, ctx):
        """Email says one person, phone says another. Refuse loudly (D26)."""
        by_email, by_phone = self._by_email(attempt, ctx), self._by_phone(attempt, ctx)
        return by_email is not None and by_phone is not None and by_email != by_phone

    def owns_book(self, attempt, ctx):
        """They already have this book. A double charge, or a slip."""
        book = ctx.deps.book_by_slug(attempt.book_slug)
        return book is not None and ctx.deps.order_for(self._by_email(attempt, ctx), book) is not None

    # ── the payment ───────────────────────────────────────────────────────
    def already_fulfilled(self, attempt, ctx):
        """Razorpay retries, and since D48 the redirect may have won the race."""
        return bool(attempt.payment_reference) and ctx.deps.order_by_reference(
            attempt.payment_reference
        ) is not None

    def phone_reuse_permitted(self, attempt, ctx):
        """TEMPORARY — `settings.ONBOARDING_ALLOW_PHONE_REUSE`. See machine.py."""
        return (
            ctx.deps.phone_reuse_allowed()
            and self._by_phone(attempt, ctx) is not None
            and self._by_email(attempt, ctx) is None
        )

    def book_unknown(self, attempt, ctx):
        return ctx.deps.book_by_slug(attempt.book_slug) is None


guards = AcquisitionGuards()
