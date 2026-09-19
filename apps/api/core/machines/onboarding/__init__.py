"""Composition. The Spec is what callers import."""

from .. import Spec
from .machine import CREATED, NEW, STATES, TRANSITIONS

onboarding_machine = Spec(
    name="onboarding",
    initial=NEW,
    states=STATES,
    transitions=TRANSITIONS,
)

__all__ = ["onboarding_machine", "NEW", "CREATED"]
