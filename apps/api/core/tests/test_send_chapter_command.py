"""`manage.py send_chapter` — the concierge's other hand (D10)."""

from io import StringIO

from django.core.files.base import ContentFile
from django.core.management import CommandError, call_command
from django.test import TestCase, override_settings

from core.models import Book, Chapter, MessageLog, Order, TemporalGrant, User

PDF = b"%PDF-1.7\n%tiny\n%%EOF\n"


@override_settings(WHATSAPP_BACKEND="console")
class SendChapterCommandTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="reader@example.com", phone="+919000000000",
            full_name="Ada Demo", password="x")
        self.book = Book.objects.create(title="TSP", slug="tsp", is_published=True)
        for i in (1, 2):
            Chapter.objects.create(book=self.book, order_index=i, title=f"Chapter {i}",
                                   file=ContentFile(PDF, name=f"c{i}.pdf"))
        Order.objects.create(user=self.user, book=self.book, pace="medium")

    def run_it(self, **kwargs):
        out = StringIO()
        call_command("send_chapter", stdout=out, **kwargs)
        return out.getvalue()

    def test_it_sends_and_logs(self):
        output = self.run_it(email="reader@example.com", chapter=1)

        self.assertIn("sent", output)
        self.assertTrue(MessageLog.objects.filter(user=self.user).exists())

    def test_it_reuses_a_live_grant(self):
        """D27. The CLI is another caller, not another policy."""
        self.run_it(email="reader@example.com", chapter=1)
        self.run_it(email="reader@example.com", chapter=1)

        self.assertEqual(TemporalGrant.objects.filter(user=self.user).count(), 1)

    def test_dry_run_sends_nothing(self):
        output = self.run_it(email="reader@example.com", chapter=1, dry_run=True)

        self.assertIn("would send", output)
        self.assertEqual(MessageLog.objects.count(), 0)
        self.assertEqual(TemporalGrant.objects.count(), 0)

    def test_an_unknown_reader_fails_clearly(self):
        with self.assertRaisesMessage(CommandError, "no reader with email"):
            self.run_it(email="nobody@example.com", chapter=1)

    def test_a_missing_chapter_fails_clearly(self):
        with self.assertRaisesMessage(CommandError, "has no chapter"):
            self.run_it(email="reader@example.com", chapter=99)

    def test_a_reader_who_does_not_own_the_book_is_refused(self):
        """access.can_read is the only access check, even from a terminal (D25)."""
        Order.objects.filter(user=self.user).delete()

        with self.assertRaisesMessage(CommandError, "owns no books"):
            self.run_it(email="reader@example.com", chapter=1)

    def test_several_books_requires_choosing_one(self):
        other = Book.objects.create(title="Other", slug="other", is_published=True)
        Chapter.objects.create(book=other, order_index=1, title="X",
                               file=ContentFile(PDF, name="x.pdf"))
        Order.objects.create(user=self.user, book=other, pace="medium")

        with self.assertRaisesMessage(CommandError, "owns several books"):
            self.run_it(email="reader@example.com", chapter=1)

    def test_naming_the_book_resolves_it(self):
        other = Book.objects.create(title="Other", slug="other", is_published=True)
        Chapter.objects.create(book=other, order_index=1, title="X",
                               file=ContentFile(PDF, name="x.pdf"))
        Order.objects.create(user=self.user, book=other, pace="medium")

        output = self.run_it(email="reader@example.com", chapter=1, book="other")

        self.assertIn("sent", output)
