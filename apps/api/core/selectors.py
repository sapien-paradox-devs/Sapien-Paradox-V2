"""Reads that endpoints need, so `api/` does not query the ORM itself (D61).

Starts with reading progress (D70). The existing ORM calls in `api/` move here
in the rebuild (R3); new reads are written here from the start.
"""

from dataclasses import dataclass

from .models import ReadingProgress


@dataclass(frozen=True)
class Progress:
    furthest: float
    completed: bool


NONE = Progress(furthest=0.0, completed=False)


def progress_for(user, chapter) -> Progress:
    row = ReadingProgress.objects.filter(user=user, chapter=chapter).first()
    return _progress(row) if row else NONE


def progress_by_chapter(user) -> dict[int, Progress]:
    """Every chapter this reader has progress on, in one query — Home reads it per row."""
    return {row.chapter_id: _progress(row) for row in ReadingProgress.objects.filter(user=user)}


def _progress(row: ReadingProgress) -> Progress:
    return Progress(furthest=1.0 if row.completed_at else row.furthest, completed=row.completed_at is not None)
