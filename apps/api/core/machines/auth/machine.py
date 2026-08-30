"""The auth machine.

    anonymous <──LOGOUT── authenticated
              ──LOGIN───>

The subject is the session, which has no state column — nothing here is
persisted, so `dispatch` is called without a `persist`.

`RESET_REQUEST` is an *internal* transition: it stays in `anonymous` and still
runs its guard and its effect. It earns a row because the rule and the effect
belong to the flow, not because the state changes.
"""

from . import actions, guards

ANONYMOUS = "anonymous"
AUTHENTICATED = "authenticated"

STATES = [ANONYMOUS, AUTHENTICATED]

TRANSITIONS = [
    {
        "trigger": "LOGIN",
        "source": ANONYMOUS,
        "dest": AUTHENTICATED,
        "conditions": [guards.credentials_valid],
        "after": [actions.open_session],
    },
    {
        "trigger": "LOGIN",
        "source": ANONYMOUS,
        "dest": None,
        "after": [actions.refuse_bad_credentials],
    },
    {
        "trigger": "LOGOUT",
        "source": AUTHENTICATED,
        "dest": ANONYMOUS,
        "after": [actions.close_session],
    },
    {
        "trigger": "RESET_REQUEST",
        "source": ANONYMOUS,
        "dest": None,
        "conditions": [guards.phone_known, guards.under_rate_limit],
        "after": [actions.send_reset],
    },
    # Same answer either way, so the endpoint cannot be used to enumerate
    # accounts. Not a refusal — the caller is told nothing went wrong.
    {
        "trigger": "RESET_REQUEST",
        "source": ANONYMOUS,
        "dest": None,
        "after": [actions.say_nothing],
    },
    {
        "trigger": "RESET_CONFIRM",
        "source": ANONYMOUS,
        "dest": AUTHENTICATED,
        "conditions": [guards.reset_token_live],
        "after": [actions.set_password],
    },
    {
        "trigger": "RESET_CONFIRM",
        "source": ANONYMOUS,
        "dest": None,
        "after": [actions.refuse_bad_reset_token],
    },
]
