"""The only Django-aware module in the machine layer (D37).

Everything else in `core/machines/` is plain Python operating on an object's
attributes. Moving to another framework or ORM means rewriting this file and
nothing else.
"""

from typing import Any

from . import Spec, TransitionResult, dispatch


def save_state(subject: Any, state_attr: str = "state") -> None:
    """Persist just the state column.

    `update_fields` keeps a transition from overwriting columns an action
    changed on a different instance of the same row.
    """
    fields = [state_attr, *getattr(subject, "_machine_dirty", [])]
    subject.save(update_fields=sorted(set(fields)))


def touched(subject: Any, *field_names: str) -> None:
    """Mark extra columns an action changed, so `save_state` includes them.

        def stamp_opened(grant, ctx):
            grant.opened_at = ctx.deps.now()
            touched(grant, "opened_at")
    """
    dirty = list(getattr(subject, "_machine_dirty", []))
    dirty.extend(field_names)
    subject._machine_dirty = dirty


def dispatch_model(
    spec: Spec,
    subject: Any,
    event: str,
    state_attr: str = "state",
    **kwargs: Any,
) -> TransitionResult:
    """`dispatch`, wired to save the Django model when the transition succeeds."""
    subject._machine_dirty = []
    return dispatch(
        spec,
        subject,
        event,
        persist=lambda s: save_state(s, state_attr),
        state_attr=state_attr,
        **kwargs,
    )
