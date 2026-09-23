"""Book metadata and video (D76, D77): the gated chapter video, the public
sample, the proxied cover, and the upload validators."""

from datetime import timedelta
from unittest import mock

from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from django.test import TestCase, override_settings
from django.utils import timezone

from core.models import Book, Chapter, Order, TemporalGrant, User
from core.services import media

PDF_BYTES = b"%PDF-1.7\n%fake\n%%EOF\n"
MP4_BYTES = b"\x00\x00\x00\x18ftypmp42fake video"
PNG_BYTES = b"\x89PNG\r\n\x1a\nfake cover"


class Fixture(TestCase):
    def setUp(self):
        self.reader = User.objects.create_user(
            email="reader@example.com", phone="+919000000000",
            full_name="Test Reader", password="x",
        )
        self.book = Book.objects.create(
            title="The Sapien Paradox", slug="tsp", is_published=True,
            author="A. Author", description="A book.",
        )
        self.chapter = Chapter.objects.create(
            book=self.book, order_index=1, title="The Long Descent",
            file=ContentFile(PDF_BYTES, name="ch1.pdf"),
            video=ContentFile(MP4_BYTES, name="ch1.mp4"),
        )
        Order.objects.create(user=self.reader, book=self.book, pace="medium")
        self.grant = TemporalGrant.objects.create(user=self.reader, chapter=self.chapter)


class ChapterVideoEndpointTests(Fixture):
    def test_chapter_meta_says_there_is_a_video(self):
        response = self.client.get(f"/api/grants/{self.grant.token}")

        self.assertTrue(response.json()["hasVideo"])

    def test_a_live_owned_grant_gets_a_url(self):
        response = self.client.get(f"/api/grants/{self.grant.token}/video")

        self.assertEqual(response.status_code, 200)
        self.assertIn(self.chapter.video.name, response.json()["url"])

    def test_the_url_is_never_a_pdf_or_the_chapter_file(self):
        url = self.client.get(f"/api/grants/{self.grant.token}/video").json()["url"]

        self.assertNotIn(self.chapter.file.name, url)

    def test_an_expired_grant_gets_410(self):
        self.grant.expires_at = timezone.now() - timedelta(seconds=1)
        self.grant.save()

        response = self.client.get(f"/api/grants/{self.grant.token}/video")

        self.assertEqual(response.status_code, 410)

    def test_a_chapter_without_a_video_gets_404(self):
        self.chapter.video = ""
        self.chapter.save()

        response = self.client.get(f"/api/grants/{self.grant.token}/video")

        self.assertEqual(response.status_code, 404)

    def test_a_reader_who_no_longer_owns_the_book_gets_403(self):
        Order.objects.filter(user=self.reader).delete()

        response = self.client.get(f"/api/grants/{self.grant.token}/video")

        self.assertEqual(response.status_code, 403)

    def test_an_unknown_token_gets_401(self):
        response = self.client.get("/api/grants/not-a-token/video")

        self.assertEqual(response.status_code, 401)

    def test_watching_does_not_stamp_opened_at(self):
        self.client.get(f"/api/grants/{self.grant.token}/video")
        self.grant.refresh_from_db()

        self.assertIsNone(self.grant.opened_at)


class PublicBookMediaTests(Fixture):
    def test_the_sample_needs_no_session(self):
        self.book.sample_video = ContentFile(MP4_BYTES, name="sample.mp4")
        self.book.save()

        response = self.client.get("/api/books/tsp/sample")

        self.assertEqual(response.status_code, 200)
        self.assertIn(self.book.sample_video.name, response.json()["url"])

    def test_a_book_without_a_sample_gets_404(self):
        self.assertEqual(self.client.get("/api/books/tsp/sample").status_code, 404)

    def test_the_cover_is_proxied_bytes_not_a_url(self):
        self.book.cover = ContentFile(PNG_BYTES, name="cover.png")
        self.book.save()

        response = self.client.get("/api/books/tsp/cover")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "image/png")
        self.assertEqual(response.content, PNG_BYTES)

    def test_a_book_without_a_cover_gets_404(self):
        self.assertEqual(self.client.get("/api/books/tsp/cover").status_code, 404)

    def test_an_unpublished_book_exposes_neither(self):
        self.book.is_published = False
        self.book.cover = ContentFile(PNG_BYTES, name="cover.png")
        self.book.sample_video = ContentFile(MP4_BYTES, name="sample.mp4")
        self.book.save()

        self.assertEqual(self.client.get("/api/books/tsp/cover").status_code, 404)
        self.assertEqual(self.client.get("/api/books/tsp/sample").status_code, 404)


class SignedUrlTests(TestCase):
    def test_an_empty_field_has_no_url(self):
        self.assertIsNone(media.signed_url(None))

    @override_settings(VIDEO_URL_TTL_SECONDS=123)
    def test_r2_urls_are_presigned_with_the_ttl(self):
        storage = mock.Mock(bucket_name="b")
        storage.url.return_value = "https://r2.example/signed"
        field = mock.Mock(storage=storage, __bool__=lambda self: True)
        field.name = "videos/x.mp4"

        self.assertEqual(media.signed_url(field), "https://r2.example/signed")
        storage.url.assert_called_once_with("videos/x.mp4", expire=123)

    @override_settings(API_BASE_URL="http://api.local")
    def test_local_storage_falls_back_to_an_absolute_media_url(self):
        storage = mock.Mock(spec=["url"])
        storage.url.return_value = "/media/videos/x.mp4"
        field = mock.Mock(storage=storage, __bool__=lambda self: True)
        field.name = "videos/x.mp4"

        self.assertEqual(media.signed_url(field), "http://api.local/media/videos/x.mp4")


class ValidatorTests(TestCase):
    def test_a_video_must_be_mp4(self):
        book = Book(title="T", slug="t", sample_video=ContentFile(MP4_BYTES, name="s.mov"))

        with self.assertRaises(ValidationError):
            book.full_clean()

    @override_settings(VIDEO_MAX_MB=0)
    def test_a_video_over_the_cap_is_refused(self):
        book = Book(title="T", slug="t", sample_video=ContentFile(MP4_BYTES, name="s.mp4"))

        with self.assertRaises(ValidationError):
            book.full_clean()

    def test_a_cover_must_be_an_image_type(self):
        book = Book(title="T", slug="t", cover=ContentFile(PNG_BYTES, name="c.gif"))

        with self.assertRaises(ValidationError):
            book.full_clean()
