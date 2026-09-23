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


# ── the in-app admin (D82) ────────────────────────────────────────────────────


def readers(search: str = "", status: str = "all"):
    """Readers for the admin list: newest first, with how many books each owns.

    `search` matches name, email or phone. `status` is `all`, `active` or
    `inactive`. Staff accounts are included: an owner who is also a reader should
    be findable too.
    """
    from django.db.models import Count, Q

    from .models import User

    rows = User.objects.annotate(book_count=Count("orders")).order_by("-date_joined")
    search = (search or "").strip()
    if search:
        rows = rows.filter(
            Q(full_name__icontains=search) | Q(email__icontains=search) | Q(phone__icontains=search)
        )
    if status == "active":
        rows = rows.filter(is_active=True)
    elif status == "inactive":
        rows = rows.filter(is_active=False)
    return rows


def reader(reader_id):
    """One reader, with the same `book_count` the list carries. None if unknown."""
    return readers().filter(pk=reader_id).first()


def orders_of(user):
    return user.orders.select_related("book").order_by("created_at")


def is_erased(user) -> bool:
    from .models import AccountChange

    return user.account_changes.filter(action=AccountChange.ERASED).exists()
