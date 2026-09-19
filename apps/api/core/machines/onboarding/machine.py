"""The onboarding machine — D26's four identity cases, as four rows.

    new ──SUBMIT──> created

The subject is a transient attempt, not a stored row, so nothing here is
persisted by the machine — `create_reader` owns its own transaction.

Rows are evaluated top to bottom and the first whose guards all pass fires, so
**the order below is part of the logic**: the "already owns it" row must sit
above the plain exact-match row, or a returning reader would be silently
charged twice for the same book.

There is no `refused` state. A refusal is the outcome, carried as a code, and
the attempt object is discarded either way.
"""

from . import actions, guards

NEW = "new"
CREATED = "created"

STATES = [NEW, CREATED]

TRANSITIONS = [
    # Neither field is taken — a genuinely new reader.
    {
        "trigger": "SUBMIT",
        "source": NEW,
        "dest": CREATED,
        "conditions": [guards.identity_unknown],
        "after": [actions.create_reader],
    },
    # Known reader who already has this book. A double charge, or a slip.
    # Must be checked before the row below.
    {
        "trigger": "SUBMIT",
        "source": NEW,
        "dest": None,
        "conditions": [guards.is_exact_match, guards.already_owns_book],
        "after": [actions.refuse_duplicate_order],
    },
    # Known reader, new book. Normal, not an error — `Order` is unique per
    # (user, book), not per user (D26).
    {
        "trigger": "SUBMIT",
        "source": NEW,
        "dest": CREATED,
        "conditions": [guards.is_exact_match],
        "after": [actions.add_order],
    },
    # One field matches and the other does not, or they match two different
    # readers. Refuse loudly rather than guess (D26).
    {
        "trigger": "SUBMIT",
        "source": NEW,
        "dest": None,
        "after": [actions.refuse_identity_conflict],
    },
]
