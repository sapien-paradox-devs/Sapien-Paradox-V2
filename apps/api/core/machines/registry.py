"""Every machine, in one place, so tooling can find them all.

Only for tools that need to enumerate machines — the diagram command. Callers
import their machine directly.
"""

from .auth import auth_machine
from .delivery import delivery_machine
from .onboarding import onboarding_machine
from .reading import reading_machine

MACHINES = [auth_machine, delivery_machine, onboarding_machine, reading_machine]
