"""Reading progress — where a reader is in a chapter, and whether they finished (D70).

Two writes, both idempotent. `furthest` only grows and stops short of 1 until
the reader declares the chapter complete; completion is never inferred.

**Nothing in access, grants, delivery or cadence imports this module.**
Chapters unlock on a schedule, never on completion — a test holds that line.
"""

from django.db import transaction
from django.utils import timezone

from ..models import ReadingProgress

# Scrolling to the last line is not finishing: only `complete` reaches 1.
UNFINISHED_CEILING = 0.99


def record(user, chapter, fraction: float) -> ReadingProgress:
    """Move the reader's furthest point forward. Never backward, never to 1."""
    fraction = min(max(float(fraction), 0.0), UNFINISHED_CEILING)

    with transaction.atomic():
        progress, _ = ReadingProgress.objects.select_for_update().get_or_create(
            user=user, chapter=chapter
        )
        if progress.completed_at is None and fraction > progress.furthest:
            progress.furthest = fraction
            progress.save(update_fields=["furthest", "updated_at"])
    return progress


def complete(user, chapter) -> ReadingProgress:
    """The reader says they are done. The first time counts; asking again changes nothing."""
    with transaction.atomic():
        progress, _ = ReadingProgress.objects.select_for_update().get_or_create(
            user=user, chapter=chapter
        )
        if progress.completed_at is None:
            progress.completed_at = timezone.now()
            progress.furthest = 1.0
            progress.save(update_fields=["completed_at", "furthest", "updated_at"])
    return progress
