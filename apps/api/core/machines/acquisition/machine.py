"""The acquisition transition table. **Data only** (D59).

    new ──PAID──▶ fulfilled

Rows are evaluated top to bottom and the first whose guards all pass fires, so
**the order below is part of the logic**:

- `already_fulfilled` must be first, or a Razorpay retry creates a second reader.
- `owns_book` must sit above the plain exact-match row, or a returning reader is
  silently charged twice for the same book.
- the bare row at the bottom is the catch-all: one field matched and the other
  did not.

`dest: None` is an internal transition — it runs its action without moving the
state, which is what every refusal wants. There is no `refused` state: a refusal
is the outcome, carried as a code, and the attempt is discarded either way.
"""

from .actions import actions
from .guards import guards

NEW = "new"
FULFILLED = "fulfilled"

STATES = [NEW, FULFILLED]

TRANSITIONS = [
    # Idempotency. Razorpay retries on any non-2xx and on timeout, and since D48
    # the redirect may have fulfilled already.
    {
        "trigger": "PAID",
        "source": NEW,
        "dest": None,
        "conditions": [guards.already_fulfilled],
        "after": [actions.note_duplicate],
    },
    # A slug we do not sell. Not retryable, and not a 500.
    {
        "trigger": "PAID",
        "source": NEW,
        "dest": None,
        "conditions": [guards.book_unknown],
        "after": [actions.refuse_unknown_book],
    },
    # D26 case 1 — neither field taken. A genuinely new reader.
    {
        "trigger": "PAID",
        "source": NEW,
        "dest": FULFILLED,
        "conditions": [guards.identity_unknown],
        "after": [actions.create_reader],
    },
    # D26 case 2 — known reader who already owns this book. MUST precede the row
    # below. They want the links again, not a refusal, so the reference is
    # adopted on the way past.
    {
        "trigger": "PAID",
        "source": NEW,
        "dest": None,
        "conditions": [guards.is_exact_match, guards.owns_book],
        "after": [actions.adopt_reference, actions.refuse_already_owns],
    },
    # D26 case 3 — known reader, new book. Normal: `Order` is unique per
    # (user, book), not per user.
    {
        "trigger": "PAID",
        "source": NEW,
        "dest": FULFILLED,
        "conditions": [guards.is_exact_match],
        "after": [actions.create_reader],
    },
    # #214 — returning reader, no phone provided. Email alone identifies.
    # MUST sit after the phone-bearing exact-match rows so a submission with
    # both fields still goes through the stricter check.
    {
        "trigger": "PAID",
        "source": NEW,
        "dest": None,
        "conditions": [guards.is_email_only_match, guards.owns_book],
        "after": [actions.adopt_reference, actions.refuse_already_owns],
    },
    {
        "trigger": "PAID",
        "source": NEW,
        "dest": FULFILLED,
        "conditions": [guards.is_email_only_match],
        "after": [actions.create_reader],
    },
    # D26 case 4a — the two fields name two different readers.
    {
        "trigger": "PAID",
        "source": NEW,
        "dest": None,
        "conditions": [guards.matches_two_readers],
        "after": [actions.refuse_two_readers],
    },
    # TEMPORARY — `settings.ONBOARDING_ALLOW_PHONE_REUSE`, a relaxation of D26 so
    # the flow can be tested with one phone number. **Delete this row before a
    # real reader signs up**: with it on, anyone who knows a reader's number can
    # attach a purchase to their account. Being a row rather than a branch inside
    # `_resolve_identity` is the point — reverting it is deleting these six lines.
    {
        "trigger": "PAID",
        "source": NEW,
        "dest": FULFILLED,
        "conditions": [guards.phone_reuse_permitted],
        "after": [actions.create_reader_for_phone],
    },
    # D26 case 4b — one field matched, the other did not. Kept DISTINCT from the
    # row above: the frontend renders them differently.
    {
        "trigger": "PAID",
        "source": NEW,
        "dest": None,
        "after": [actions.refuse_partial_match],
    },
]
