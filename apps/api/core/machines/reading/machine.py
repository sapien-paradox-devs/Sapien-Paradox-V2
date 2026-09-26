"""The reading machine — a grant's life, as a table.

    scheduled ──UNLOCK──> live ──OPEN──> opened

    live | opened ──RECORD_PROGRESS / COMPLETE──> (same state)

`WATCH` (a chapter's video, D76) is the same kind of row: gated like `OPEN`,
changing nothing, producing a short-lived URL.

Progress and completion (D70) change no grant state: they are internal
transitions whose effect lands in `ReadingProgress`, through `ctx.deps`. They
are rows here so the question "may this token do this?" is answered in one
place, by the same guards as `OPEN`, and never re-asked in an endpoint.

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
    # Cadence (D39, D50). The tick sends this; nothing else does. A failed send
    # refuses inside `deliver_chapter`, which is not persisted, so the grant
    # stays scheduled and the next tick retries it (D40).
    {
        "trigger": "UNLOCK",
        "source": SCHEDULED,
        "dest": LIVE,
        "conditions": [guards.is_due, guards.still_owns],
        "after": [actions.deliver_chapter],
    },
    # Due, but the reader was deactivated, erased or refunded (D80). Nothing is
    # sent, and the row stays scheduled, so a reactivated reader picks up where
    # the schedule has reached. Not yet due is `no_transition`.
    {
        "trigger": "UNLOCK",
        "source": SCHEDULED,
        "dest": None,
        "conditions": [guards.is_due],
        "after": [actions.refuse_not_owner],
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
    # Reading progress (D70). The reader's place, keyed on reader + chapter by
    # the service, so a re-issued link keeps it. Same guards as OPEN.
    {
        "trigger": "RECORD_PROGRESS",
        "source": [LIVE, OPENED],
        "dest": None,
        "conditions": [guards.is_live, guards.owns_book],
        "after": [actions.record_progress],
    },
    {
        "trigger": "RECORD_PROGRESS",
        "source": [LIVE, OPENED],
        "dest": None,
        "conditions": [guards.is_past_expiry],
        "after": [actions.refuse_expired],
    },
    {
        "trigger": "RECORD_PROGRESS",
        "source": [LIVE, OPENED],
        "dest": None,
        "after": [actions.refuse_not_owner],
    },
    # The reader marks the chapter complete — the only way to 100% (D70).
    {
        "trigger": "COMPLETE",
        "source": [LIVE, OPENED],
        "dest": None,
        "conditions": [guards.is_live, guards.owns_book],
        "after": [actions.complete_chapter],
    },
    {
        "trigger": "COMPLETE",
        "source": [LIVE, OPENED],
        "dest": None,
        "conditions": [guards.is_past_expiry],
        "after": [actions.refuse_expired],
    },
    {
        "trigger": "COMPLETE",
        "source": [LIVE, OPENED],
        "dest": None,
        "after": [actions.refuse_not_owner],
    },
    # The chapter's video (D76). Gated exactly like the pages: a live token that
    # still owns the book. Changes nothing on the grant, so every row is internal.
    {
        "trigger": "WATCH",
        "source": [LIVE, OPENED],
        "dest": None,
        "conditions": [guards.is_live, guards.owns_book, guards.has_video],
        "after": [actions.sign_video],
    },
    {
        "trigger": "WATCH",
        "source": [LIVE, OPENED],
        "dest": None,
        "conditions": [guards.is_past_expiry],
        "after": [actions.refuse_expired],
    },
    # Checked after ownership, so a stranger learns nothing about which chapters
    # have videos: they get `not_owner` below.
    {
        "trigger": "WATCH",
        "source": [LIVE, OPENED],
        "dest": None,
        "conditions": [guards.owns_book],
        "after": [actions.refuse_no_video],
    },
    {
        "trigger": "WATCH",
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
