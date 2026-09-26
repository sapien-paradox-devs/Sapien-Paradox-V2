"""`manage.py cadence_tick` — what the Render Cron Job runs (D39, D50)."""

from datetime import timedelta
from io import StringIO
from unittest.mock import patch

from django.core.files.base import ContentFile
from django.core.management import CommandError, call_command
from django.test import TestCase, override_settings
from django.utils import timezone

from core.models import Book, Chapter, MessageLog, Order, TemporalGrant, User
from core.services import whatsapp

PDF = b"%PDF-1.7\n%tiny\n%%EOF\n"


@override_settings(WHATSAPP_BACKEND="console")
class CadenceTickCommandTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="reader@example.com", phone="+919000000000",
            full_name="Ada Demo", password="x")
        self.book = Book.objects.create(title="TSP", slug="tsp", is_published=True)
        self.chapters = [
            Chapter.objects.create(book=self.book, order_index=i, title=f"Chapter {i}",
                                   file=ContentFile(PDF, name=f"c{i}.pdf"))
            for i in (1, 2, 3)
        ]
        Order.objects.create(user=self.user, book=self.book, pace="fast")

    def scheduled(self, chapter, unlock_at):
        return TemporalGrant.objects.create(
            user=self.user, chapter=chapter,
            state=TemporalGrant.SCHEDULED, unlock_at=unlock_at)

    def run_it(self, **kwargs):
        out = StringIO()
        call_command("cadence_tick", stdout=out, **kwargs)
        return out.getvalue()

    def test_nothing_due_prints_zeros(self):
        self.scheduled(self.chapters[1], timezone.now() + timedelta(days=1))

        output = self.run_it()

        self.assertIn("due=0 sent=0 failed=0 refused=0", output)
        self.assertEqual(MessageLog.objects.count(), 0)

    def test_a_due_grant_is_sent_and_becomes_live(self):
        grant = self.scheduled(self.chapters[1], timezone.now() - timedelta(minutes=1))
        later = self.scheduled(self.chapters[2], timezone.now() + timedelta(days=1))

        output = self.run_it()

        self.assertIn("due=1 sent=1 failed=0 refused=0", output)
        grant.refresh_from_db()
        later.refresh_from_db()
        self.assertEqual(grant.state, TemporalGrant.LIVE)
        self.assertEqual(later.state, TemporalGrant.SCHEDULED)
        self.assertEqual(MessageLog.objects.filter(grant=grant).count(), 1)

    def test_dry_run_sends_nothing_and_prints_no_token(self):
        grant = self.scheduled(self.chapters[1], timezone.now() - timedelta(minutes=1))

        output = self.run_it(dry_run=True)

        self.assertIn("due=1", output)
        self.assertIn(f"grant {grant.pk}", output)
        self.assertIn("reader@example.com", output)
        self.assertIn("TSP", output)
        self.assertIn("chapter 2", output)
        self.assertNotIn(grant.token, output, "D22: a token is a credential")
        self.assertEqual(MessageLog.objects.count(), 0)
        grant.refresh_from_db()
        self.assertEqual(grant.state, TemporalGrant.SCHEDULED)

    def test_a_failed_send_exits_non_zero_and_stays_scheduled(self):
        """Red in the Render dashboard; the next tick retries (D40)."""
        grant = self.scheduled(self.chapters[1], timezone.now() - timedelta(minutes=1))

        def refused(to_phone, body):
            raise whatsapp.PermanentDeliveryError("twilio 400 code=21211: invalid 'To'")

        with patch("core.services.whatsapp._backend", return_value=refused):
            with self.assertRaisesMessage(CommandError, "failed=1"):
                self.run_it()

        grant.refresh_from_db()
        self.assertEqual(grant.state, TemporalGrant.SCHEDULED)
        self.assertEqual(MessageLog.objects.get(grant=grant).status, MessageLog.FAILED)

    def test_a_refusal_is_not_a_failure(self):
        """A reader who no longer owns the book is sent nothing, and the run stays green (D80)."""
        grant = self.scheduled(self.chapters[1], timezone.now() - timedelta(minutes=1))
        Order.objects.filter(user=self.user).delete()

        output = self.run_it()

        self.assertIn("due=1 sent=0 failed=0 refused=1", output)
        grant.refresh_from_db()
        self.assertEqual(grant.state, TemporalGrant.SCHEDULED)
