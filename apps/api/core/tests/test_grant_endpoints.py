"""The product's main path: a WhatsApp link, tapped.

No session, no cookies — the token in the path is the whole credential (D29).
"""

from datetime import timedelta

from django.core.files.base import ContentFile
from django.test import TestCase
from django.utils import timezone

from core.models import Book, Chapter, Order, TemporalGrant, User

PDF_BYTES = b"%PDF-1.7\n%fake chapter bytes for the test\n%%EOF\n"


class GrantEndpointTests(TestCase):
    def setUp(self):
        self.reader = User.objects.create_user(
            email="reader@example.com", phone="+919000000000",
            full_name="Test Reader", password="x",
        )
        self.book = Book.objects.create(title="The Sapien Paradox", slug="tsp", is_published=True)
        self.chapter = Chapter.objects.create(
            book=self.book, order_index=1, title="The Long Descent",
            file=ContentFile(PDF_BYTES, name="ch1.pdf"),
        )
        Order.objects.create(user=self.reader, book=self.book, pace="medium")
        self.grant = TemporalGrant.objects.create(user=self.reader, chapter=self.chapter)

    # ── the happy path ───────────────────────────────────────────────
    def test_a_live_token_returns_chapter_meta(self):
        response = self.client.get(f"/api/grants/{self.grant.token}")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            "bookTitle": "The Sapien Paradox", "number": 1, "title": "The Long Descent",
            "firstOpen": True,
        })

    def test_the_pdf_streams(self):
        response = self.client.get(f"/api/grants/{self.grant.token}/pdf")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertEqual(b"".join(response.streaming_content), PDF_BYTES)

    def test_opening_stamps_opened_at_once_only(self):
        self.client.get(f"/api/grants/{self.grant.token}")
        self.grant.refresh_from_db()
        first = self.grant.opened_at
        self.assertIsNotNone(first)

        self.client.get(f"/api/grants/{self.grant.token}")
        self.grant.refresh_from_db()
        self.assertEqual(self.grant.opened_at, first)   # D21: the FIRST open

    def test_first_open_is_reported_once_for_the_ceremony(self):
        """#116: the chamber's ceremony plays on the first open of a link only."""
        first = self.client.get(f"/api/grants/{self.grant.token}")
        again = self.client.get(f"/api/grants/{self.grant.token}")

        self.assertTrue(first.json()["firstOpen"])
        self.assertFalse(again.json()["firstOpen"])

    def test_a_refused_open_does_not_spend_the_first_open(self):
        """An expired link lands in sanctuary; its ceremony is not used up."""
        self.grant.expires_at = timezone.now() - timedelta(seconds=1)
        self.grant.save(update_fields=["expires_at"])

        self.client.get(f"/api/grants/{self.grant.token}")

        self.grant.refresh_from_db()
        self.assertIsNone(self.grant.opened_at)

    def test_reopening_within_seven_days_still_works(self):
        self.client.get(f"/api/grants/{self.grant.token}")
        again = self.client.get(f"/api/grants/{self.grant.token}")
        self.assertEqual(again.status_code, 200)

    # ── refusals, which must stay distinguishable (D25) ──────────────
    def test_an_expired_token_is_410_so_the_chamber_shows_sanctuary(self):
        self.grant.expires_at = timezone.now() - timedelta(seconds=1)
        self.grant.save(update_fields=["expires_at"])

        response = self.client.get(f"/api/grants/{self.grant.token}")

        self.assertEqual(response.status_code, 410)

    def test_a_reader_who_no_longer_owns_the_book_is_403_not_410(self):
        """Sanctuary has a button. This must not offer it."""
        Order.objects.filter(user=self.reader).delete()

        response = self.client.get(f"/api/grants/{self.grant.token}")

        self.assertEqual(response.status_code, 403)

    def test_an_unknown_token_is_refused(self):
        response = self.client.get("/api/grants/not-a-real-token")
        self.assertIn(response.status_code, (401, 404))

    def test_the_pdf_is_refused_for_an_expired_token(self):
        self.grant.expires_at = timezone.now() - timedelta(seconds=1)
        self.grant.save(update_fields=["expires_at"])

        response = self.client.get(f"/api/grants/{self.grant.token}/pdf")

        self.assertEqual(response.status_code, 410)

    # ── the one #71 asks for ─────────────────────────────────────────
    def test_no_response_ever_resembles_a_storage_url(self):
        """A public storage URL would bypass the token, the expiry and
        revocation at the infrastructure layer while this code still looked
        correct (D19). Nothing may leak one."""
        meta = self.client.get(f"/api/grants/{self.grant.token}")
        pdf = self.client.get(f"/api/grants/{self.grant.token}/pdf")

        haystack = (
            meta.content.decode().lower()
            + " ".join(f"{k}:{v}" for k, v in meta.items()).lower()
            + " ".join(f"{k}:{v}" for k, v in pdf.items()).lower()
        )

        for needle in ("http://", "https://", "r2.cloudflarestorage", "amazonaws",
                       "x-amz-", "signature=", ".s3.", "presigned"):
            self.assertNotIn(needle, haystack, f"{needle!r} leaked into a response")
