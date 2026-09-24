"""The book workspace's API and services (D83–D86): drafts, uploads, chapters,
and the rules that protect readers once a book is published."""

from unittest import mock

from django.core.files.base import ContentFile
from django.test import Client, TestCase, override_settings

from core.models import Book, Chapter, Order, TemporalGrant, User
from core.services import uploads
from core.tests.test_pages import a_pdf

PNG = b"\x89PNG\r\n\x1a\nfake"
MP4 = b"\x00\x00\x00\x18ftypmp42 fake"


class Fixture(TestCase):
    def setUp(self):
        self.staff = User.objects.create_user(
            email="owner@example.com", phone="+919000000001", full_name="Owner",
            password="pw", is_staff=True,
        )
        self.client.force_login(self.staff)

    def create_book(self, **fields):
        body = {"title": "The Sapien Paradox", "author": "A. Author", **fields}
        return self.client.post("/api/admin/books", body, content_type="application/json")

    def upload(self, book_id, destination, filename, data, chapter_id=None, title=""):
        """The three steps of D85, through the no-R2 path the tests run on."""
        plan = self.client.post("/api/admin/uploads", {
            "destination": destination, "bookId": book_id, "chapterId": chapter_id,
            "filename": filename, "size": len(data), "title": title,
        }, content_type="application/json")
        assert plan.status_code == 200, plan.json()
        ticket = plan.json()["ticket"]
        sent = self.client.put("/api/admin/uploads/direct", data,
                               content_type="application/octet-stream",
                               HTTP_X_UPLOAD_TICKET=ticket)
        assert sent.status_code == 204, sent.content
        return self.client.post("/api/admin/uploads/complete", {"ticket": ticket},
                                content_type="application/json")


class BookTests(Fixture):
    def test_a_new_book_is_an_unpublished_draft(self):
        response = self.create_book()
        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertFalse(body["isPublished"])
        self.assertEqual(body["slug"], "the-sapien-paradox")
        self.assertEqual(body["checklist"], {"hasChapters": False, "allReady": False,
                                             "hasCover": False, "passes": False})

    def test_slugs_stay_unique(self):
        self.create_book()
        self.assertEqual(self.create_book().json()["slug"], "the-sapien-paradox-2")

    def test_a_title_is_required(self):
        response = self.create_book(title="  ")
        self.assertEqual(response.json(), {"code": "title_required", "field": "title"})

    def test_details_are_editable(self):
        book_id = self.create_book().json()["id"]
        response = self.client.patch(f"/api/admin/books/{book_id}",
                                     {"description": "Slow.", "priceMinorUnits": 49900},
                                     content_type="application/json")
        self.assertEqual(response.json()["priceMinorUnits"], 49900)

    def test_drafts_are_listed_for_staff_and_not_sold(self):
        self.create_book()
        self.assertEqual(len(self.client.get("/api/admin/books").json()["books"]), 1)
        self.assertEqual(Client().get("/api/books").json(), [])

    def test_a_reader_cannot_reach_the_book_api(self):
        reader = User.objects.create_user(email="r@x.com", phone="+919000000002",
                                          full_name="R", password="pw")
        client = Client()
        client.force_login(reader)
        self.assertEqual(client.get("/api/admin/books").status_code, 401)


class UploadTests(Fixture):
    def setUp(self):
        super().setUp()
        self.book_id = int(self.create_book().json()["id"])

    def test_a_pdf_becomes_a_ready_chapter_at_the_end(self):
        response = self.upload(self.book_id, "new_chapter", "01 The Descent.pdf", a_pdf(3),
                               title="The Descent")
        self.assertEqual(response.status_code, 200)
        chapter = response.json()["book"]["chapters"][0]
        self.assertEqual((chapter["number"], chapter["title"], chapter["status"]),
                         (1, "The Descent", "ready"))
        self.assertEqual(chapter["pageCount"], 3)

        second = self.upload(self.book_id, "new_chapter", "02.pdf", a_pdf(1), title="Two")
        self.assertEqual([c["number"] for c in second.json()["book"]["chapters"]], [1, 2])

    def test_a_pdf_that_does_not_render_is_marked_failed_not_lost(self):
        response = self.upload(self.book_id, "new_chapter", "bad.pdf", b"%PDF-1.7 broken")
        self.assertEqual(response.json()["book"]["chapters"][0]["status"], "failed")

    def test_completing_twice_does_not_make_two_chapters(self):
        data = a_pdf(1)
        plan = self.client.post("/api/admin/uploads", {
            "destination": "new_chapter", "bookId": self.book_id, "filename": "a.pdf",
            "size": len(data)}, content_type="application/json").json()
        self.client.put("/api/admin/uploads/direct", data, content_type="application/octet-stream",
                        HTTP_X_UPLOAD_TICKET=plan["ticket"])
        for _ in range(2):
            self.client.post("/api/admin/uploads/complete", {"ticket": plan["ticket"]},
                             content_type="application/json")
        self.assertEqual(Chapter.objects.filter(book_id=self.book_id).count(), 1)

    def test_videos_and_cover_attach_where_they_are_sent(self):
        chapter_id = int(self.upload(self.book_id, "new_chapter", "a.pdf", a_pdf(1))
                         .json()["chapterId"])
        self.upload(self.book_id, "chapter_video", "a.mp4", MP4, chapter_id=chapter_id)
        self.upload(self.book_id, "book_video", "intro.mp4", MP4)
        self.upload(self.book_id, "book_sample", "sample.mp4", MP4)
        body = self.upload(self.book_id, "book_cover", "cover.png", PNG).json()["book"]

        self.assertTrue(body["chapters"][0]["hasVideo"])
        self.assertTrue(body["hasVideo"])
        self.assertTrue(body["hasSample"])
        self.assertTrue(body["hasCover"])
        cover = self.client.get(f"/api/admin/books/{self.book_id}/cover")
        self.assertEqual(cover.content, PNG)

    def test_wrong_types_and_sizes_are_refused_before_any_bytes_move(self):
        cases = [
            ({"destination": "new_chapter", "filename": "a.docx", "size": 10}, "not_pdf"),
            ({"destination": "book_video", "filename": "a.mov", "size": 10}, "not_video"),
            ({"destination": "book_cover", "filename": "a.gif", "size": 10}, "not_image"),
            ({"destination": "new_chapter", "filename": "a.pdf", "size": 0}, "empty_file"),
            ({"destination": "new_chapter", "filename": "a.pdf", "size": 10**10}, "pdf_too_large"),
            ({"destination": "nowhere", "filename": "a.pdf", "size": 10}, "unknown_destination"),
        ]
        for fields, code in cases:
            response = self.client.post("/api/admin/uploads", {"bookId": self.book_id, **fields},
                                        content_type="application/json")
            self.assertEqual(response.json()["code"], code, fields)

    def test_a_body_that_is_not_the_promised_size_is_refused(self):
        plan = self.client.post("/api/admin/uploads", {
            "destination": "new_chapter", "bookId": self.book_id, "filename": "a.pdf",
            "size": 100}, content_type="application/json").json()
        sent = self.client.put("/api/admin/uploads/direct", b"short",
                               content_type="application/octet-stream",
                               HTTP_X_UPLOAD_TICKET=plan["ticket"])
        self.assertEqual(sent.json()["code"], "size_mismatch")

    def test_a_forged_ticket_is_refused(self):
        response = self.client.post("/api/admin/uploads/complete", {"ticket": "not-signed"},
                                    content_type="application/json")
        self.assertEqual(response.json()["code"], "bad_ticket")

    def test_completing_before_sending_is_refused(self):
        plan = self.client.post("/api/admin/uploads", {
            "destination": "book_video", "bookId": self.book_id, "filename": "a.mp4",
            "size": 10}, content_type="application/json").json()
        response = self.client.post("/api/admin/uploads/complete", {"ticket": plan["ticket"]},
                                    content_type="application/json")
        self.assertEqual(response.json()["code"], "not_uploaded")


class R2PlanTests(TestCase):
    """With R2, bytes go straight to R2 on presigned URLs, in parts when large."""

    def setUp(self):
        self.book = Book.objects.create(title="T", slug="t")
        self.client_mock = mock.Mock()
        self.client_mock.generate_presigned_url.side_effect = (
            lambda op, Params, ExpiresIn: f"https://r2.example/{op}/{Params.get('PartNumber', 0)}")
        self.client_mock.create_multipart_upload.return_value = {"UploadId": "up-1"}
        storage = mock.Mock(bucket_name="bucket")
        storage.connection.meta.client = self.client_mock
        patcher = mock.patch.object(uploads, "default_storage", storage)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_a_small_file_gets_one_signed_put(self):
        plan = uploads.start(destination="new_chapter", book=self.book, chapter=None,
                             filename="a.pdf", size=1024)
        self.assertEqual(plan.mode, "single")
        self.assertEqual(plan.url, "https://r2.example/put_object/0")

    @override_settings(UPLOAD_MULTIPART_THRESHOLD_MB=1, UPLOAD_PART_MB=5)
    def test_a_large_file_goes_up_in_parts(self):
        plan = uploads.start(destination="book_video", book=self.book, chapter=None,
                             filename="a.mp4", size=12 * 1024 * 1024)
        self.assertEqual(plan.mode, "multipart")
        self.assertEqual(len(plan.part_urls), 3)  # 5 + 5 + 2 MB
        self.assertEqual(plan.upload_id, "up-1")


class ChapterRuleTests(Fixture):
    def setUp(self):
        super().setUp()
        self.book = Book.objects.create(title="Book", slug="book")
        self.chapters = [
            Chapter.objects.create(book=self.book, order_index=n, title=f"C{n}",
                                   file=ContentFile(a_pdf(1), name=f"c{n}.pdf"),
                                   page_layout={"pages": []})
            for n in (1, 2, 3)
        ]

    def order(self, ids):
        return self.client.post(f"/api/admin/books/{self.book.pk}/chapters/order",
                                {"chapterIds": ids}, content_type="application/json")

    def test_a_draft_reorders(self):
        c1, c2, c3 = self.chapters
        body = self.order([c3.pk, c1.pk, c2.pk]).json()
        self.assertEqual([c["title"] for c in body["chapters"]], ["C3", "C1", "C2"])

    def test_a_published_book_keeps_its_order(self):
        Book.objects.filter(pk=self.book.pk).update(is_published=True)
        c1, c2, c3 = self.chapters
        self.assertEqual(self.order([c3.pk, c1.pk, c2.pk]).json()["code"], "published_order_fixed")

    def test_a_reorder_must_name_every_chapter(self):
        self.assertEqual(self.order([self.chapters[0].pk]).json()["code"], "order_mismatch")

    def test_deleting_a_draft_chapter_closes_the_gap(self):
        body = self.client.delete(f"/api/admin/chapters/{self.chapters[0].pk}").json()
        self.assertEqual([c["number"] for c in body["chapters"]], [1, 2])

    def test_a_chapter_someone_holds_a_link_to_stays(self):
        reader = User.objects.create_user(email="r@x.com", phone="+919000000002",
                                          full_name="R", password="pw")
        Order.objects.create(user=reader, book=self.book, pace="medium")
        TemporalGrant.objects.create(user=reader, chapter=self.chapters[0])
        response = self.client.delete(f"/api/admin/chapters/{self.chapters[0].pk}")
        self.assertEqual(response.json()["code"], "chapter_has_readers")

    def test_renaming(self):
        body = self.client.patch(f"/api/admin/chapters/{self.chapters[1].pk}", {"title": "Clocks"},
                                 content_type="application/json").json()
        self.assertEqual(body["chapters"][1]["title"], "Clocks")


class PublishTests(Fixture):
    def setUp(self):
        super().setUp()
        self.book = Book.objects.create(title="Book", slug="book")

    def publish(self):
        return self.client.post(f"/api/admin/books/{self.book.pk}/publish")

    def test_the_checklist_must_pass(self):
        self.assertEqual(self.publish().json()["code"], "checklist_incomplete")

        chapter = Chapter.objects.create(book=self.book, order_index=1, title="C",
                                         file=ContentFile(a_pdf(1), name="c.pdf"))
        self.book.cover = ContentFile(PNG, name="c.png")
        self.book.save()
        self.assertEqual(self.publish().json()["code"], "checklist_incomplete")  # not rendered

        chapter.page_layout = {"pages": []}
        chapter.save()
        body = self.publish().json()
        self.assertTrue(body["isPublished"])
        self.assertTrue(Client().get("/api/books").json())

    def test_a_published_book_keeps_its_cover(self):
        Book.objects.filter(pk=self.book.pk).update(is_published=True, cover="covers/x.png")
        response = self.client.delete(f"/api/admin/books/{self.book.pk}/media/cover")
        self.assertEqual(response.json()["code"], "published_needs_cover")
