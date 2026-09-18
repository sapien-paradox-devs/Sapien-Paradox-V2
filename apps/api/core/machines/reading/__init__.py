"""Composition. The Spec is what callers import."""

from .. import Spec
from .machine import LIVE, OPENED, SCHEDULED, STATES, TRANSITIONS

reading_machine = Spec(
    name="reading",
    initial=LIVE,
    states=STATES,
    transitions=TRANSITIONS,
)

__all__ = ["reading_machine", "SCHEDULED", "LIVE", "OPENED"]
