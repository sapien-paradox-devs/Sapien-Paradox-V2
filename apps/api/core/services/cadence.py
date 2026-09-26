"""Cadence: the schedule is rows, and a tick fires whatever is due (D39, D50).

    cadence.schedule(order) -> list[TemporalGrant]   chapters 2…N, state=scheduled
    cadence.due(now)        -> QuerySet              scheduled and past unlock_at
    cadence.tick(now=None)  -> TickResult            UNLOCK every due grant

`schedule` runs inside `create_reader`'s transaction. It mints rows and sends
nothing. `tick` is what the cron job runs every fifteen minutes, and it is the
only thing that sends `UNLOCK` (D39). The reading machine decides what UNLOCK
does; this module only finds the grants and hands them over.

Nothing here retries. A failed send leaves the grant `scheduled`, and the next
tick finds it again (D40).
"""

from dataclasses import dataclass
from datetime import datetime, timedelta
from types import SimpleNamespace
from zoneinfo import ZoneInfo

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from ..machines.binding import dispatch_model
from ..machines.reading import reading_machine
from ..models import TemporalGrant


@dataclass(frozen=True)
class TickResult:
    due: int
    sent: int
    failed: int
    """The send did not land. Still `scheduled`; the next tick retries it."""
    refused: int
    """Not sent on purpose: the reader no longer owns the book (D80), or another
    tick was already holding the row. Also still `scheduled`, where it applies."""


def unlock_at_for(purchased_at: datetime, pace: str, position: int) -> datetime | None:
    """When the chapter at `position` (0 = the first) unlocks.

    The first chapter is delivered at purchase and has no unlock moment. The
    chapter at position *p* unlocks *p* delays later: at the delivery hour on
    that day when the anchor is set, or at the exact offset when it isn't.
    """
    if position <= 0:
        return None

    exact = purchased_at + timedelta(days=settings.PACE_DELAY_DAYS[pace] * position)

    hour = settings.CADENCE_DELIVERY_HOUR
    if hour is None:
        return exact

    local = exact.astimezone(ZoneInfo(settings.CADENCE_TIMEZONE))
    return local.replace(hour=hour, minute=0, second=0, microsecond=0)


def schedule(order) -> list[TemporalGrant]:
    """Mint the rest of the book as `scheduled` grants.

    Rows, not sends, so it is safe inside the caller's transaction (D26).
    `expires_at` keeps its default; the reading machine re-stamps it from
    delivery when the grant unlocks (D50). Otherwise a row minted today for a
    chapter due next month would be dead on arrival.

    Idempotent: a chapter this reader already holds a grant for is skipped.
    """
    chapters = list(order.book.chapters.order_by("order_index"))
    held = set(
        TemporalGrant.objects.filter(user=order.user, chapter__in=chapters)
        .values_list("chapter_id", flat=True)
    )

    rows = [
        TemporalGrant(
            user=order.user,
            chapter=chapter,
            state=TemporalGrant.SCHEDULED,
            unlock_at=unlock_at_for(order.created_at, order.pace, position),
        )
        for position, chapter in enumerate(chapters)
        if position > 0 and chapter.pk not in held
    ]
    return TemporalGrant.objects.bulk_create(rows)


def due(now: datetime | None = None):
    """The scheduled grants whose moment has passed, oldest first."""
    now = now or timezone.now()
    return TemporalGrant.objects.filter(
        state=TemporalGrant.SCHEDULED, unlock_at__lte=now
    ).order_by("unlock_at", "pk")


def tick(now: datetime | None = None) -> TickResult:
    """Send UNLOCK to every due grant, one transaction each.

    Each row is selected again under `select_for_update(skip_locked=True)`
    inside its own transaction. A second tick running at the same time (a
    manual run, an overlap) either finds the row locked and skips it, or finds
    it already `live` and never sees it. Render already serialises runs of one
    cron job; this makes the guarantee ours rather than the host's. On SQLite
    the lock is a no-op, which is fine for local work.

    The lock lasts for one WhatsApp send, a few seconds at worst with D17's
    bounded retry, and it is on one row that nobody else wants.
    """
    now = now or timezone.now()
    ids = list(due(now).values_list("pk", flat=True))

    sent = failed = refused = 0
    for pk in ids:
        with transaction.atomic():
            grant = (
                TemporalGrant.objects.select_for_update(skip_locked=True)
                .select_related("user", "chapter__book")
                .filter(pk=pk, state=TemporalGrant.SCHEDULED)
                .first()
            )
            if grant is None:
                refused += 1
                continue

            result = dispatch_model(reading_machine, grant, "UNLOCK", deps=_deps(now))

        if result.ok:
            sent += 1
        elif result.refusal == "delivery_failed":
            failed += 1
        else:
            refused += 1

    return TickResult(due=len(ids), sent=sent, failed=failed, refused=refused)


def _deps(now: datetime) -> SimpleNamespace:
    """What UNLOCK's guards and actions need (D37), with the tick's clock."""
    from . import access, whatsapp

    return SimpleNamespace(
        now=lambda: now,
        owns=access.owns,
        send_chapter=whatsapp.send_chapter,
        grant_expiry=grant_expiry,
    )


def grant_expiry(delivered_at: datetime) -> datetime:
    """Seven days from delivery (D8, D50)."""
    return delivered_at + timedelta(days=settings.GRANT_TTL_DAYS)
