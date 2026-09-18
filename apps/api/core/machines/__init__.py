"""The machine layer — the flow (D36).

A machine is a `Spec`: a list of states and a transition table. The table is
declarative data, so it can be read on its own to see what the application
does.

Nothing in this package imports Django (D37). Guards and actions receive their
dependencies through `Ctx.deps`, so a machine can be exercised against fakes
before the real service exists. `binding.py` is the only Django-aware module.

    result = dispatch(reading_machine, grant, "OPEN", deps=deps, user=user)
    if not result.ok:
        return REFUSAL_STATUS[result.refusal], {"detail": result.refusal}
"""

import logging
from dataclasses import dataclass, field
from types import SimpleNamespace
from typing import Any, Callable

from transitions import Machine

# The library logs every callback at INFO and every ignored trigger at WARNING.
# An ignored trigger is normal here — an event with no matching row is inert by
# design (D38) — so both would be noise in the stdout log D22 specifies.
logging.getLogger("transitions").setLevel(logging.ERROR)

_ATTACHED = "_machine_attached"


@dataclass(frozen=True)
class Spec:
    """A machine definition. Pure data — no behaviour, no I/O."""

    name: str
    initial: str
    states: list[str]
    transitions: list[dict]


@dataclass(frozen=True)
class TransitionResult:
    """What `dispatch` gives back (D38).

    `refusal` is a short code — "expired", "not_owner" — that the API layer maps
    to a status code. No layer below the API knows what a 403 is.
    """

    ok: bool
    state: str
    refusal: str | None = None
    data: Any = None


@dataclass
class Ctx:
    """What a guard or action is handed, and where it writes its answer.

    `deps` are injected callables (the seams). `payload` is whatever the caller
    passed to `dispatch`. Both are attribute-accessed, so a guard reads
    `ctx.deps.can_read(...)` rather than indexing a dict.
    """

    deps: SimpleNamespace = field(default_factory=SimpleNamespace)
    payload: SimpleNamespace = field(default_factory=SimpleNamespace)
    refusal: str | None = None
    data: Any = None

    def refuse(self, code: str) -> None:
        """Record why this event was refused. Sets `ok=False` on the result."""
        self.refusal = code

    def produce(self, value: Any) -> None:
        """Record what the transition produced — a MessageLog, a token."""
        self.data = value


def guard(fn: Callable) -> Callable:
    """Adapt `fn(subject, ctx)` to what `transitions` calls with send_event."""

    def callback(event):
        return fn(event.model, event.kwargs["ctx"])

    callback.__name__ = fn.__name__
    return callback


# Actions and guards take the same two arguments, so they adapt the same way.
action = guard


def _attach(spec: Spec, subject: Any, state_attr: str) -> None:
    """Give `subject` its trigger methods, once."""
    if getattr(subject, _ATTACHED, None) == spec.name:
        return

    transitions = []
    for row in spec.transitions:
        row = dict(row)
        if "conditions" in row:
            row["conditions"] = [guard(g) for g in row["conditions"]]
        if "after" in row:
            row["after"] = [action(a) for a in row["after"]]
        transitions.append(row)

    Machine(
        model=subject,
        states=spec.states,
        transitions=transitions,
        initial=getattr(subject, state_attr, None) or spec.initial,
        model_attribute=state_attr,
        send_event=True,
        auto_transitions=False,
        # An event with no transition from the current state is inert, not an
        # error. Refusals are explicit rows that call `ctx.refuse`.
        ignore_invalid_triggers=True,
    )
    setattr(subject, _ATTACHED, spec.name)


def dispatch(
    spec: Spec,
    subject: Any,
    event: str,
    deps: SimpleNamespace | None = None,
    persist: Callable[[Any], None] | None = None,
    state_attr: str = "state",
    **payload: Any,
) -> TransitionResult:
    """Send `event` to `subject`'s machine and report what happened.

    The subject is persisted only when the transition succeeds, so an action
    that refuses leaves nothing written (D40).
    """
    ctx = Ctx(
        deps=deps if deps is not None else SimpleNamespace(),
        payload=SimpleNamespace(**payload),
    )
    _attach(spec, subject, state_attr)

    before = getattr(subject, state_attr)
    fired = subject.trigger(event, ctx=ctx)

    # A refusal row *does* fire — it records why and, being an internal
    # transition, leaves the state alone. An action that moves the state and
    # *then* refuses is rolled back here, so the object never claims a state
    # that was never persisted (D40).
    ok = bool(fired) and ctx.refusal is None
    if ok:
        if persist is not None:
            persist(subject)
    else:
        setattr(subject, state_attr, before)

    refusal = ctx.refusal if ctx.refusal else (None if fired else "no_transition")
    return TransitionResult(
        ok=ok, state=getattr(subject, state_attr), refusal=refusal, data=ctx.data
    )
