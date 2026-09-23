"""Chapter pages as watermarked images; the PDF never leaves the server (D73)."""

import io
from datetime import timedelta

from django.core.files.base import ContentFile
from django.test import TestCase
from django.utils import timezone
from PIL import Image
from pypdf import PdfWriter

from core.models import Book, Chapter, Order, TemporalGrant, User
from core.services import pages


def a_pdf(page_count: int = 2, sections: tuple[str, ...] = ()) -> bytes:
    """A real, renderable PDF. Blank pages, optionally with bookmarks, one per page."""
    writer = PdfWriter()
    for _ in range(page_count):
        writer.add_blank_page(width=300, height=400)
    parent = None
    for index, title in enumerate(sections):
        # The last bookmark nests under the first, to prove depth is kept.
        nested = index == len(sections) - 1 and index > 0
        item = writer.add_outline_item(title, index % page_count, parent=parent if nested else None)
        if index == 0:
            parent = item
    buffer = io.BytesIO()
    writer.write(buffer)
    return buffer.getvalue()


class PagesTestBase(TestCase):
    def setUp(self):
        self.reader = User.objects.create_user(
            email="reader@example.com", phone="+919876543210",
            full_name="Ada Demo", password="x",
        )
        self.book = Book.objects.create(title="The Sapien Paradox", slug="tsp", is_published=True)
        self.chapter = Chapter.objects.create(
            book=self.book, order_index=1, title="The Long Descent",
            file=ContentFile(a_pdf(2, ("Opening", "Turn", "Aside")), name="ch1.pdf"),
        )
        Order.objects.create(user=self.reader, book=self.book, pace="medium")
        self.grant = TemporalGrant.objects.create(user=self.reader, chapter=self.chapter)


class RenderingTests(PagesTestBase):
    def test_rendering_records_every_page_and_its_size(self):
        self.assertTrue(pages.render_and_save(self.chapter))

        self.chapter.refresh_from_db()
        layout = self.chapter.page_layout
        self.assertEqual(len(layout["pages"]), 2)
        self.assertEqual((layout["pages"][0]["width"], layout["pages"][0]["height"]), (300, 400))

    def test_each_page_is_stored_as_an_image(self):
        pages.render_and_save(self.chapter)
        self.chapter.refresh_from_db()

        storage = self.chapter.file.storage
        for page in self.chapter.page_layout["pages"]:
            with storage.open(page["image"], "rb") as handle:
                image = Image.open(handle)
                self.assertEqual(image.format, "WEBP")
                self.assertEqual(image.width, pages.RENDER_WIDTH)

    def test_the_outline_becomes_sections_with_pages_and_depth(self):
        pages.render_and_save(self.chapter)
        self.chapter.refresh_from_db()

        self.assertEqual(self.chapter.page_layout["sections"], [
            {"title": "Opening", "page": 0, "depth": 0},
            {"title": "Aside", "page": 0, "depth": 1},
            {"title": "Turn", "page": 1, "depth": 0},
        ])

    def test_a_pdf_without_bookmarks_has_no_sections(self):
        self.chapter.file.save("plain.pdf", ContentFile(a_pdf(1)), save=True)
        pages.render_and_save(self.chapter)
        self.chapter.refresh_from_db()

        self.assertEqual(self.chapter.page_layout["sections"], [])

    def test_a_file_that_is_not_a_pdf_fails_without_raising(self):
        self.chapter.file.save("broken.pdf", ContentFile(b"not a pdf"), save=True)

        self.assertFalse(pages.render_and_save(self.chapter))
        self.chapter.refresh_from_db()
        self.assertIsNone(self.chapter.page_layout)

    def test_rendering_again_replaces_the_images_in_place(self):
        pages.render_and_save(self.chapter)
        self.chapter.refresh_from_db()
        first = [p["image"] for p in self.chapter.page_layout["pages"]]

        pages.render_and_save(self.chapter)
        self.chapter.refresh_from_db()
        self.assertEqual([p["image"] for p in self.chapter.page_layout["pages"]], first)


class ServingTests(PagesTestBase):
    def setUp(self):
        super().setUp()
        pages.render_and_save(self.chapter)
        self.chapter.refresh_from_db()

    def test_the_layout_gives_sizes_and_sections_but_never_storage_paths(self):
        response = self.client.get(f"/api/grants/{self.grant.token}/pages")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["pages"], [{"width": 300, "height": 400}] * 2)
        self.assertEqual(len(body["sections"]), 3)
        self.assertNotIn("image", response.content.decode())
        self.assertNotIn(".webp", response.content.decode())

    def test_a_page_is_an_image_no_cache_may_keep(self):
        response = self.client.get(f"/api/grants/{self.grant.token}/pages/1")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "image/webp")
        self.assertEqual(response["Cache-Control"], "private, no-store")
        self.assertEqual(Image.open(io.BytesIO(response.content)).format, "WEBP")

    def test_the_served_page_carries_a_watermark(self):
        """A blank page renders pure white; the served copy must not be."""
        served = Image.open(io.BytesIO(
            self.client.get(f"/api/grants/{self.grant.token}/pages/1").content
        )).convert("L")

        darkest, _ = served.getextrema()
        self.assertLess(darkest, 250)

    def test_page_numbers_outside_the_chapter_are_404(self):
        self.assertEqual(self.client.get(f"/api/grants/{self.grant.token}/pages/0").status_code, 404)
        self.assertEqual(self.client.get(f"/api/grants/{self.grant.token}/pages/3").status_code, 404)

    def test_a_reader_who_no_longer_owns_the_book_gets_no_pages(self):
        Order.objects.filter(user=self.reader).delete()

        self.assertEqual(self.client.get(f"/api/grants/{self.grant.token}/pages").status_code, 403)
        self.assertEqual(self.client.get(f"/api/grants/{self.grant.token}/pages/1").status_code, 403)

    def test_an_expired_link_gets_no_pages(self):
        self.grant.expires_at = timezone.now() - timedelta(seconds=1)
        self.grant.save(update_fields=["expires_at"])

        self.assertEqual(self.client.get(f"/api/grants/{self.grant.token}/pages/1").status_code, 410)

    def test_a_chapter_not_yet_rendered_is_404_not_a_crash(self):
        self.chapter.page_layout = None
        self.chapter.save(update_fields=["page_layout"])

        self.assertEqual(self.client.get(f"/api/grants/{self.grant.token}/pages").status_code, 404)
        self.assertEqual(self.client.get(f"/api/grants/{self.grant.token}/pages/1").status_code, 404)


class MarkTests(TestCase):
    def test_the_phone_keeps_its_country_code_and_last_four(self):
        self.assertEqual(pages.mask_phone("+919876543210"), "+91 ******3210")

    def test_a_short_or_missing_phone_is_left_alone(self):
        self.assertEqual(pages.mask_phone("+12345"), "+12345")
        self.assertEqual(pages.mask_phone(None), "")

    def test_the_mark_names_the_reader(self):
        user = User(full_name="Ada Demo", phone="+919876543210")
        self.assertTrue(pages.mark_for(user).startswith("Ada Demo · +91 "))
