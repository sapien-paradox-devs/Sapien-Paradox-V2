"""Reading progress — quiet, forward-only, and declared complete (D70)."""

import ast
from datetime import timedelta
from pathlib import Path

from django.core.files.base import ContentFile
from django.test import TestCase
from django.utils import timezone

from core.models import Book, Chapter, Order, ReadingProgress, TemporalGrant, User
from core.services import grants, progress

CORE = Path(__file__).resolve().parents[1]


class ProgressTestBase(TestCase):
    def setUp(self):
        self.reader = User.objects.create_user(
            email="reader@example.com", phone="+919000000000",
            full_name="Test Reader", password="x",
        )
        self.book = Book.objects.create(title="The Sapien Paradox", slug="tsp", is_published=True)
        self.chapters = [
            Chapter.objects.create(
                book=self.book, order_index=n, title=f"Chapter {n}",
                file=ContentFile(b"%PDF-1.7\n%%EOF\n", name=f"ch{n}.pdf"),
            )
            for n in (1, 2)
        ]
        self.chapter = self.chapters[0]
        Order.objects.create(user=self.reader, book=self.book, pace="medium")
        self.grant = TemporalGrant.objects.create(user=self.reader, chapter=self.chapter)

    def place(self) -> ReadingProgress:
        return ReadingProgress.objects.get(user=self.reader, chapter=self.chapter)


class ServiceTests(ProgressTestBase):
    def test_progress_only_moves_forward(self):
        progress.record(self.reader, self.chapter, 0.6)
        progress.record(self.reader, self.chapter, 0.3)

        self.assertEqual(self.place().furthest, 0.6)

    def test_reaching_the_last_line_is_not_finishing(self):
        progress.record(self.reader, self.chapter, 1.0)

        self.assertEqual(self.place().furthest, progress.UNFINISHED_CEILING)
        self.assertIsNone(self.place().completed_at)

    def test_nonsense_is_clamped(self):
        progress.record(self.reader, self.chapter, -4)
        self.assertEqual(self.place().furthest, 0.0)

    def test_completing_makes_it_whole(self):
        progress.complete(self.reader, self.chapter)

        self.assertEqual(self.place().furthest, 1.0)
        self.assertIsNotNone(self.place().completed_at)

    def test_completing_twice_keeps_the_first_moment(self):
        first = progress.complete(self.reader, self.chapter).completed_at
        second = progress.complete(self.reader, self.chapter).completed_at

        self.assertEqual(first, second)

    def test_scrolling_after_completing_changes_nothing(self):
        progress.complete(self.reader, self.chapter)
        progress.record(self.reader, self.chapter, 0.2)

        self.assertEqual(self.place().furthest, 1.0)


class EndpointTests(ProgressTestBase):
    def url(self, grant=None, action="progress"):
        return f"/api/grants/{(grant or self.grant).token}/{action}"

    def test_the_reader_can_record_progress_with_only_a_token(self):
        response = self.client.post(self.url(), {"furthest": 0.4}, content_type="application/json")

        self.assertEqual(response.status_code, 204)
        self.assertEqual(self.place().furthest, 0.4)

    def test_the_reader_can_mark_the_chapter_complete(self):
        response = self.client.post(self.url(action="complete"))

        self.assertEqual(response.status_code, 204)
        self.assertIsNotNone(self.place().completed_at)

    def test_the_chamber_is_told_where_the_reader_got_to(self):
        progress.record(self.reader, self.chapter, 0.35)

        body = self.client.get(f"/api/grants/{self.grant.token}").json()

        self.assertEqual((body["furthest"], body["completed"]), (0.35, False))

    def test_an_expired_link_records_nothing(self):
        self.grant.expires_at = timezone.now() - timedelta(seconds=1)
        self.grant.save(update_fields=["expires_at"])

        response = self.client.post(self.url(), {"furthest": 0.5}, content_type="application/json")

        self.assertEqual(response.status_code, 410)
        self.assertFalse(ReadingProgress.objects.exists())

    def test_a_reader_who_no_longer_owns_the_book_records_nothing(self):
        Order.objects.filter(user=self.reader).delete()

        response = self.client.post(self.url(action="complete"))

        self.assertEqual(response.status_code, 403)
        self.assertFalse(ReadingProgress.objects.exists())

    def test_progress_survives_a_reissued_link(self):
        self.client.post(self.url(), {"furthest": 0.7}, content_type="application/json")
        fresh = grants.reissue(self.grant)

        body = self.client.get(f"/api/grants/{fresh.token}").json()

        self.assertEqual(body["furthest"], 0.7)


class HomeTests(ProgressTestBase):
    def test_home_shows_each_chapter_and_the_book_total(self):
        self.client.force_login(self.reader)
        progress.complete(self.reader, self.chapters[0])

        book = self.client.get("/api/home").json()["books"][0]

        first, second = book["chapters"]
        self.assertEqual((first["progress"], first["completed"]), (1.0, True))
        self.assertEqual((second["progress"], second["completed"]), (0.0, False))
        self.assertEqual(book["progress"], 0.5)


class ConstraintTests(TestCase):
    def test_nothing_that_unlocks_or_delivers_reads_progress(self):
        """D70: chapters unlock on a schedule, never on completion."""
        guarded = [CORE / "services" / name for name in ("access.py", "grants.py", "whatsapp.py")]
        guarded += list((CORE / "machines").rglob("*.py"))

        for path in guarded:
            names = {
                node.id if isinstance(node, ast.Name) else getattr(node, "attr", "")
                for node in ast.walk(ast.parse(path.read_text()))
                if isinstance(node, (ast.Name, ast.Attribute))
            }
            imports = [
                alias.name
                for node in ast.walk(ast.parse(path.read_text()))
                if isinstance(node, (ast.Import, ast.ImportFrom))
                for alias in node.names
            ]
            self.assertNotIn("ReadingProgress", names, path.name)
            self.assertNotIn("progress", imports, path.name)
