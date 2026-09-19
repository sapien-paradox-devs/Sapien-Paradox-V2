"""Home — the reader's library (D11).

**No tokens in the payload.** A link is minted when the reader asks for one, not
once per chapter per page load. Tokens are credentials (D22); putting five of
them in a response that gets cached, logged and screenshotted would undo the
point of expiry.

Read/unread comes from `opened_at`, which the reading machine stamps on the
first open only — a quiet mark, not a progress bar.
"""

from ninja import Router

from ..auth import session_auth
from ..models import Chapter, Order, TemporalGrant
from ..schemas.home import BookOut, ChapterOut, HomeOut

router = Router()


@router.get("/home", response=HomeOut, auth=session_auth, url_name="home")
def home(request):
    """Only what this reader has earned.

    Books come from `Order`, which is the entitlement — never from "all
    published books", because that would show a reader a library they have not
    bought.
    """
    user = request.auth

    orders = (
        Order.objects.filter(user=user)
        .select_related("book")
        .order_by("created_at")
    )

    # One query for every chapter this reader has ever opened, rather than one
    # per chapter row. Home is the screen a reader returns to most.
    opened_ids = set(
        TemporalGrant.objects.filter(user=user, opened_at__isnull=False)
        .values_list("chapter_id", flat=True)
    )

    books = []
    for order in orders:
        chapters = Chapter.objects.filter(book=order.book).order_by("order_index")
        books.append(
            BookOut(
                id=str(order.book.pk),
                title=order.book.title,
                chapters=[
                    ChapterOut(
                        id=str(chapter.pk),
                        number=chapter.order_index,
                        title=chapter.title,
                        read=chapter.pk in opened_ids,
                    )
                    for chapter in chapters
                ],
            )
        )

    return HomeOut(books=books)
