"""The acquisition machine — a purchase becomes a reader (D59, D69).

    new ──PAID──▶ fulfilled        (+ four refusal rows)

**The subject is a transient purchase attempt, never the `Order` row it
creates.** Solidus tied its order state machine to its checkout-flow states and
has not untangled it since 2015 (their issue #142). Nothing here is written to
the entity the flow produces.

Before this machine was wired, D26's four identity cases existed three times —
this table, `_resolve_identity`'s if-ladder, and `_fulfil`'s. Now once.
"""

from dataclasses import dataclass

from .. import Spec
from .machine import FULFILLED, NEW, STATES, TRANSITIONS


@dataclass
class PurchaseAttempt:
    """What a paid payment link means, before anything is written.

    Transient by design (see the module docstring). `state` exists only because
    `dispatch` needs somewhere to put it; nothing persists it.
    """

    full_name: str
    email: str
    phone: str
    book_slug: str
    pace: str
    payment_reference: str = ""
    state: str = NEW


acquisition_machine = Spec(
    name="acquisition",
    initial=NEW,
    states=STATES,
    transitions=TRANSITIONS,
)

__all__ = ["acquisition_machine", "PurchaseAttempt", "STATES", "TRANSITIONS",
           "NEW", "FULFILLED"]
