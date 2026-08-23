"""The deploy check.

Deliberately trivial and dependency-free apart from the database. It is what the host
polls, so it must not reach Twilio, Anthropic, or object storage — a health check that
fails because a third party is slow is worse than no health check.
"""

from django.db import connection
from ninja import Router

from core.schemas.common import HealthOut

router = Router()


@router.get("/health", response=HealthOut, auth=None)
def health(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        database = "ok"
    except Exception:
        database = "unavailable"

    return HealthOut(status="ok", database=database)
