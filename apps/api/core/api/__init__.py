"""The NinjaAPI instance and router registration.

This package is HTTP only — Ninja schemas in, Ninja schemas out. Business logic lives in
`core/services/`. If a module in here imports the ORM to make a decision, it is in the
wrong layer.
"""

from ninja import NinjaAPI

from .auth import router as auth_router
from .chat import router as chat_router
from .checkout import router as checkout_router
from .grants import router as grants_router
from .health import router as health_router
from .home import router as home_router
from .read import router as read_router
from .reset import router as reset_router

api = NinjaAPI(
    title="Sapien Paradox",
    version="0.1.0",
    urls_namespace="api",
    docs_url="/docs",
)

api.add_router("", health_router, tags=["health"])
api.add_router("", grants_router, tags=["grants"])
api.add_router("", auth_router, tags=["auth"])
api.add_router("", reset_router, tags=["auth"])
api.add_router("", home_router, tags=["home"])
api.add_router("", read_router, tags=["read"])
api.add_router("", checkout_router, tags=["checkout"])
api.add_router("", chat_router, tags=["companion"])
