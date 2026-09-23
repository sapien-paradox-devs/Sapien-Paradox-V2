"""Every machine, in one place, so tooling can find them all.

Only for tools that need to enumerate machines — the diagram command. Callers
import their machine directly.
"""

from .delivery import delivery_machine
from .acquisition import acquisition_machine
from .reading import reading_machine

MACHINES = [acquisition_machine, delivery_machine, reading_machine]
