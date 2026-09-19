"""Composition. The Spec is what callers import."""

from .. import Spec
from .machine import FAILED, PENDING, SENT, STATES, TRANSITIONS

delivery_machine = Spec(
    name="delivery",
    initial=PENDING,
    states=STATES,
    transitions=TRANSITIONS,
)

__all__ = ["delivery_machine", "PENDING", "SENT", "FAILED"]
