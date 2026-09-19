"""The reading machine — a grant's life, as a table.

    scheduled ──UNLOCK──> live ──OPEN──> opened

Read top to bottom: the first row whose guards all pass is the one that fires.

**Expiry is derived, not stored.** A grant is expired when `expires_at` has
passed, which the model already knows. Giving it a state would mean a sweeper
running to keep that state true, and two places disagreeing about the same
fact — which is what this layer exists to prevent. So `OPEN` on an expired
grant refuses without moving; sanctuary is chosen from the refusal code, not
from a stored state.
"""

from . import actions, guards

SCHEDULED = "scheduled"
LIVE = "live"
OPENED = "opened"

STATES = [SCHEDULED, LIVE, OPENED]

# `dest: None` is an internal transition — it runs its action without changing
# state, which is what every refusal wants.
TRANSITIONS = [
    # Cadence. Unreachable until `unlock_at` is set, which is after cadence
    # lands (D21, D39). The scheduler sends this; nothing else does.
    {
        "trigger": "UNLOCK",
        "source": SCHEDULED,
        "dest": LIVE,
        "conditions": [guards.is_due],
        "after": [actions.deliver_chapter],
    },
    # The ordinary path: a live token, still owned, opened for the first time.
    {
        "trigger": "OPEN",
        "source": LIVE,
        "dest": OPENED,
        "conditions": [guards.is_live, guards.owns_book],
        "after": [actions.stamp_opened],
    },
    # Re-opening is idempotent and does not restamp `opened_at` (D32).
    {
        "trigger": "OPEN",
        "source": OPENED,
        "dest": OPENED,
        "conditions": [guards.is_live, guards.owns_book],
    },
    # The link has rested. One tap fixes it, so this needs its own code (D9).
    {
        "trigger": "OPEN",
        "source": [LIVE, OPENED],
        "dest": None,
        "conditions": [guards.is_past_expiry],
        "after": [actions.refuse_expired],
    },
    # Live, but not owned — a refund or a revoked entitlement. No button helps,
    # so it must stay distinguishable from expiry (D25).
    {
        "trigger": "OPEN",
        "source": [LIVE, OPENED],
        "dest": None,
        "after": [actions.refuse_not_owner],
    },
    # Sanctuary's one tap. Mints a new row; never revives this one.
    {
        "trigger": "REISSUE",
        "source": [LIVE, OPENED],
        "dest": None,
        "conditions": [guards.owns_book],
        "after": [actions.mint_fresh_grant],
    },
    {
        "trigger": "REISSUE",
        "source": [LIVE, OPENED],
        "dest": None,
        "after": [actions.refuse_not_owner],
    },
]
