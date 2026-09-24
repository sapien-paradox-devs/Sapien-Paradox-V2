"""The book API (D84): drafts, chapters, and the rules that protect readers once
a book is published. Uploads are tested with #180."""

from django.core.files.base import ContentFile
from django.test import Client, TestCase, override_settings

from core.models import Book, Chapter, Order, TemporalGrant, User
from core.tests.test_pages import a_pdf

PNG = b"\x89PNG\r\n\x1a\nfake"


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
