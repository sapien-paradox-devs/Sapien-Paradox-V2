"""The book workspace's API (D82–D86). Staff only, CSRF enforced (StaffAuth).

**HTTP only.** Reads go through `selectors` (D61); every change is a function
in `services/catalog.py`; every upload goes through `services/uploads.py`
(D85). Refusals come back as `409 {code, field}`, which the workspace puts into
words next to what caused them.
"""

from django.http import HttpResponse
from ninja import Router
from ninja.errors import HttpError

from .. import selectors
from ..auth import staff_auth
from ..models import Chapter
from ..schemas.admin import (
    BookDetailOut,
    BookIn,
    BookListOut,
    BookRowOut,
    BookUpdateIn,
    ChapterAdminOut,
    ChapterOrderIn,
    ChapterTitleIn,
    ChecklistOut,
    RefusalOut,
    UploadCompleteIn,
    UploadDoneOut,
    UploadPlanOut,
    UploadStartIn,
)
from ..services import catalog, media, uploads

router = Router()

REFUSED = {409: RefusalOut}


def _row_fields(book) -> dict:
    return dict(
        id=str(book.pk),
        slug=book.slug,
        title=book.title,
        author=book.author,
        isPublished=book.is_published,
        chapterCount=book.chapter_count,
        readyCount=book.ready_count,
        hasCover=bool(book.cover),
        readerCount=book.reader_count,
        createdAt=book.created_at.isoformat(),
    )


def _detail(book_id) -> BookDetailOut:
    book = selectors.book_for_admin(book_id)
    if book is None:
        raise HttpError(404, "no_such_book")
    held = selectors.chapters_with_readers(book)
    check = catalog.checklist(book)
    return BookDetailOut(
        **_row_fields(book),
        description=book.description,
        priceMinorUnits=book.price_cents,
        hasVideo=bool(book.video),
        hasSample=bool(book.sample_video),
        chapters=[
            ChapterAdminOut(
                id=str(c.pk),
                number=c.order_index,
                title=c.title,
                status="ready" if c.page_layout else "failed",
                pageCount=c.page_count,
                hasVideo=bool(c.video),
                hasReaders=c.pk in held,
            )
            for c in book.chapters.order_by("order_index")
        ],
        checklist=ChecklistOut(
            hasChapters=check.has_chapters, allReady=check.all_ready,
            hasCover=check.has_cover, passes=check.passes,
        ),
    )


def _book_or_404(book_id):
    book = selectors.book_for_admin(book_id)
    if book is None:
        raise HttpError(404, "no_such_book")
    return book


def _chapter_or_404(chapter_id):
    chapter = Chapter.objects.select_related("book").filter(pk=chapter_id).first()
    if chapter is None:
        raise HttpError(404, "no_such_chapter")
    return chapter


def _refused(exc):
    return 409, RefusalOut(code=exc.code, field=getattr(exc, "field", None))


# ── books ─────────────────────────────────────────────────────────────────────


@router.get("/admin/books", response=BookListOut, auth=staff_auth, url_name="admin_books")
def list_books(request):
    return BookListOut(books=[BookRowOut(**_row_fields(b)) for b in selectors.books_for_admin()])


@router.post("/admin/books", response={201: BookDetailOut, **REFUSED}, auth=staff_auth,
             url_name="admin_book_create")
def create_book(request, payload: BookIn):
    try:
        book = catalog.create_book(title=payload.title, author=payload.author,
                                   description=payload.description,
                                   price_minor_units=payload.priceMinorUnits)
    except catalog.CatalogRefused as exc:
        return _refused(exc)
    return 201, _detail(book.pk)


@router.get("/admin/books/{book_id}", response=BookDetailOut, auth=staff_auth, url_name="admin_book")
def get_book(request, book_id: int):
    return _detail(book_id)


@router.patch("/admin/books/{book_id}", response={200: BookDetailOut, **REFUSED}, auth=staff_auth,
              url_name="admin_book_update")
def update_book(request, book_id: int, payload: BookUpdateIn):
    try:
        catalog.update_book(_book_or_404(book_id), title=payload.title, author=payload.author,
                            description=payload.description,
                            price_minor_units=payload.priceMinorUnits)
    except catalog.CatalogRefused as exc:
        return _refused(exc)
    return 200, _detail(book_id)


@router.post("/admin/books/{book_id}/publish", response={200: BookDetailOut, **REFUSED},
             auth=staff_auth, url_name="admin_book_publish")
def publish(request, book_id: int):
    try:
        catalog.publish(_book_or_404(book_id))
    except catalog.CatalogRefused as exc:
        return _refused(exc)
    return 200, _detail(book_id)


@router.post("/admin/books/{book_id}/unpublish", response=BookDetailOut, auth=staff_auth,
             url_name="admin_book_unpublish")
def unpublish(request, book_id: int):
    catalog.unpublish(_book_or_404(book_id))
    return _detail(book_id)


@router.delete("/admin/books/{book_id}/media/{which}", response={200: BookDetailOut, **REFUSED},
               auth=staff_auth, url_name="admin_book_media_remove")
def remove_media(request, book_id: int, which: str):
    try:
        catalog.remove_book_media(_book_or_404(book_id), which)
    except catalog.CatalogRefused as exc:
        return _refused(exc)
    return 200, _detail(book_id)


@router.get("/admin/books/{book_id}/cover", auth=staff_auth, url_name="admin_book_cover")
def cover(request, book_id: int):
    """The cover of any book, drafts included, proxied (mandate 3)."""
    found = media.cover_bytes(_book_or_404(book_id))
    if found is None:
        raise HttpError(404, "no_cover")
    data, content_type = found
    response = HttpResponse(data, content_type=content_type)
    response["Cache-Control"] = "private, max-age=60"
    response["X-Content-Type-Options"] = "nosniff"
    return response


# ── chapters ──────────────────────────────────────────────────────────────────


@router.patch("/admin/chapters/{chapter_id}", response={200: BookDetailOut, **REFUSED},
              auth=staff_auth, url_name="admin_chapter_rename")
def rename_chapter(request, chapter_id: int, payload: ChapterTitleIn):
    chapter = _chapter_or_404(chapter_id)
    try:
        catalog.rename_chapter(chapter, payload.title)
    except catalog.CatalogRefused as exc:
        return _refused(exc)
    return 200, _detail(chapter.book_id)


@router.post("/admin/books/{book_id}/chapters/order", response={200: BookDetailOut, **REFUSED},
             auth=staff_auth, url_name="admin_chapter_order")
def reorder(request, book_id: int, payload: ChapterOrderIn):
    try:
        catalog.reorder_chapters(_book_or_404(book_id), payload.chapterIds)
    except catalog.CatalogRefused as exc:
        return _refused(exc)
    return 200, _detail(book_id)


@router.delete("/admin/chapters/{chapter_id}", response={200: BookDetailOut, **REFUSED},
               auth=staff_auth, url_name="admin_chapter_delete")
def delete_chapter(request, chapter_id: int):
    chapter = _chapter_or_404(chapter_id)
    book_id = chapter.book_id
    try:
        catalog.delete_chapter(chapter)
    except catalog.CatalogRefused as exc:
        return _refused(exc)
    return 200, _detail(book_id)


@router.delete("/admin/chapters/{chapter_id}/video", response=BookDetailOut, auth=staff_auth,
               url_name="admin_chapter_video_remove")
def remove_chapter_video(request, chapter_id: int):
    chapter = _chapter_or_404(chapter_id)
    catalog.remove_chapter_video(chapter)
    return _detail(chapter.book_id)


@router.post("/admin/chapters/{chapter_id}/retry", response=BookDetailOut, auth=staff_auth,
             url_name="admin_chapter_retry")
def retry_chapter(request, chapter_id: int):
    """Render a chapter whose pages failed, again. One chapter per request (D85)."""
    chapter = _chapter_or_404(chapter_id)
    catalog.prepare(chapter)
    return _detail(chapter.book_id)


# ── uploads (D85) ─────────────────────────────────────────────────────────────


@router.post("/admin/uploads", response={200: UploadPlanOut, **REFUSED}, auth=staff_auth,
             url_name="admin_upload_start")
def start_upload(request, payload: UploadStartIn):
    book = _book_or_404(payload.bookId)
    chapter = None
    if payload.chapterId is not None:
        chapter = Chapter.objects.filter(pk=payload.chapterId, book=book).first()
        if chapter is None:
            raise HttpError(404, "no_such_chapter")
    elif payload.destination in ("chapter_pdf", "chapter_video"):
        return 409, RefusalOut(code="chapter_required")
    try:
        plan = uploads.start(destination=payload.destination, book=book, chapter=chapter,
                             filename=payload.filename, size=payload.size, title=payload.title)
    except uploads.UploadRefused as exc:
        return _refused(exc)
    return 200, UploadPlanOut(ticket=plan.ticket, mode=plan.mode, url=plan.url,
                              uploadId=plan.upload_id, partSize=plan.part_size,
                              partUrls=plan.part_urls, contentType=plan.content_type)


@router.put("/admin/uploads/direct", response={204: None, **REFUSED}, auth=staff_auth,
            url_name="admin_upload_direct")
def direct_upload(request):
    """The no-R2 fallback (mandate 6). The ticket travels in a header, never the URL (D22)."""
    try:
        uploads.direct(request.headers.get("X-Upload-Ticket", ""), request)
    except uploads.UploadRefused as exc:
        return _refused(exc)
    return 204, None


@router.post("/admin/uploads/complete", response={200: UploadDoneOut, **REFUSED}, auth=staff_auth,
             url_name="admin_upload_complete")
def complete_upload(request, payload: UploadCompleteIn):
    """Check, attach, and for a PDF render its pages: one chapter per request (D85)."""
    parts = [p.dict() for p in payload.parts] if payload.parts else None
    try:
        claims = uploads.complete(payload.ticket, parts)
    except uploads.UploadRefused as exc:
        return _refused(exc)
    changed = catalog.attach(claims)
    chapter_id = str(changed.pk) if isinstance(changed, Chapter) else None
    return 200, UploadDoneOut(book=_detail(claims["b"]), chapterId=chapter_id)
