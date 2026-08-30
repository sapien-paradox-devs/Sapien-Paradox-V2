"""Composition. The Spec is what callers import."""

from .. import Spec
from .machine import ANONYMOUS, AUTHENTICATED, STATES, TRANSITIONS

auth_machine = Spec(
    name="auth",
    initial=ANONYMOUS,
    states=STATES,
    transitions=TRANSITIONS,
)

__all__ = ["auth_machine", "ANONYMOUS", "AUTHENTICATED"]
