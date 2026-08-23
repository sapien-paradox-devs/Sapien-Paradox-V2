"""The NinjaAPI instance and router registration.

This package is HTTP only — Ninja schemas in, Ninja schemas out. Business logic lives in
`core/services/`. If a module in here imports the ORM to make a decision, it is in the
wrong layer.
"""

from ninja import NinjaAPI

from .health import router as health_router

api = NinjaAPI(
    title="Sapien Paradox",
    version="0.1.0",
    urls_namespace="api",
    docs_url="/docs",
)

api.add_router("", health_router, tags=["health"])
