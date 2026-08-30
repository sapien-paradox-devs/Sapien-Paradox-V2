"""The delivery machine — D27's retry policy, as three rows.

    pending ──ATTEMPT──> sent
            └─ATTEMPT──> pending   (transient, attempts left)
            └─ATTEMPT──> failed

D27 said this policy must exist exactly once, because duplicated retry rules
drift: one copy gets the never-retry-a-4xx rule and the other does not, and you
find out when a bad number has been retried for a year. Three rows in one table
is the smallest way to make a second copy impossible.

The caller performs the provider call and passes the outcome in. This machine
decides what the outcome means, never how to obtain it.
"""

from . import actions, guards

PENDING = "pending"
SENT = "sent"
FAILED = "failed"

STATES = [PENDING, SENT, FAILED]

TRANSITIONS = [
    {
        "trigger": "ATTEMPT",
        "source": PENDING,
        "dest": SENT,
        "conditions": [guards.provider_accepted],
        "after": [actions.record_sent],
    },
    # Transient and under the cap: count it and stay pending for another go.
    {
        "trigger": "ATTEMPT",
        "source": PENDING,
        "dest": PENDING,
        "conditions": [guards.is_transient, guards.has_attempts_left],
        "after": [actions.record_retry],
    },
    # Permanent, or out of attempts. Either way this is where it stops.
    {
        "trigger": "ATTEMPT",
        "source": PENDING,
        "dest": FAILED,
        "after": [actions.record_failure],
    },
]
