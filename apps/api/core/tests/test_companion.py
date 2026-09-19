"""The companion: caps, usage, and the refusals (D13, D33).

No network. `_complete` is the only vendor-aware function, so patching it is the
whole seam — which is the point of D24's vendor neutrality.
"""

from datetime import date, timedelta
from unittest.mock import patch

from django.core.files.base import ContentFile
from django.test import TestCase, override_settings
from django.utils import timezone

from core.models import Book, Chapter, ChatUsage, Order, TemporalGrant, User
from core.services import companion

PDF = b"%PDF-1.7\n%tiny\n%%EOF\n"
REPLY = companion.Reply(text="What did you make of that?", input_tokens=1200, output_tokens=40)


class Base(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="reader@example.com", phone="+919000000000",
            full_name="Ada Demo", password="x")
        self.book = Book.objects.create(title="TSP", slug="tsp", is_published=True)
        self.chapter = Chapter.objects.create(
            book=self.book, order_index=1, title="One",
            file=ContentFile(PDF, name="c1.pdf"),
            text_content="The instrument was never the difficulty. Attention was.")
        Order.objects.create(user=self.user, book=self.book, pace="medium")
        self.grant = TemporalGrant.objects.create(user=self.user, chapter=self.chapter)

    def ask(self, question="What is this about?", history=None):
        return self.client.post(
            "/api/chat",
            {"token": self.grant.token, "question": question, "history": history or []},
            content_type="application/json")


class ChatTests(Base):
    @patch("core.services.companion._complete", return_value=REPLY)
    def test_it_answers(self, _complete):
        response = self.ask()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"answer": REPLY.text})

    @patch("core.services.companion._complete", return_value=REPLY)
    def test_the_whole_chapter_goes_into_the_system_prompt(self, _complete):
        """D13, and the reason input dominates the cost (D24)."""
        self.ask()

        system = _complete.call_args.kwargs["system"]
        self.assertIn("The instrument was never the difficulty", system)
        self.assertIn("exploratory, never evaluative", system)

    @patch("core.services.companion._complete", return_value=REPLY)
    def test_usage_is_recorded(self, _complete):
        self.ask()

        usage = ChatUsage.objects.get(grant=self.grant, date=date.today())
        self.assertEqual(usage.message_count, 1)
        self.assertEqual(usage.input_tokens, 1200)
        self.assertEqual(usage.output_tokens, 40)

    @patch("core.services.companion._complete", return_value=REPLY)
    def test_usage_accumulates_rather_than_overwriting(self, _complete):
        self.ask()
        self.ask()

        usage = ChatUsage.objects.get(grant=self.grant, date=date.today())
        self.assertEqual(usage.message_count, 2)
        self.assertEqual(usage.input_tokens, 2400)

    def test_an_expired_grant_cannot_chat(self):
        self.grant.expires_at = timezone.now() - timedelta(days=1)
        self.grant.save(update_fields=["expires_at"])

        self.assertEqual(self.ask().status_code, 410)

    def test_a_reader_who_no_longer_owns_the_book_cannot_chat(self):
        Order.objects.filter(user=self.user).delete()
        self.assertEqual(self.ask().status_code, 403)

    def test_a_chapter_with_no_text_says_so_rather_than_improvising(self):
        self.chapter.text_content = ""
        self.chapter.save(update_fields=["text_content"])

        self.assertEqual(self.ask().status_code, 409)


@override_settings(COMPANION_MAX_INPUT_CHARS=20)
class CapTests(Base):
    @patch("core.services.companion._complete", return_value=REPLY)
    def test_an_over_long_message_is_refused_before_a_token_is_spent(self, _complete):
        response = self.ask(question="x" * 50)

        self.assertEqual(response.status_code, 422)
        _complete.assert_not_called()

    @override_settings(COMPANION_DAILY_MESSAGES_PER_GRANT=1)
    @patch("core.services.companion._complete", return_value=REPLY)
    def test_the_per_grant_daily_cap_holds(self, _complete):
        self.ask(question="short")
        second = self.ask(question="short")

        self.assertEqual(second.status_code, 429)
        self.assertEqual(_complete.call_count, 1)

    @override_settings(COMPANION_DAILY_MESSAGES_GLOBAL=1)
    @patch("core.services.companion._complete", return_value=REPLY)
    def test_the_global_cap_bounds_the_bill_across_readers(self, _complete):
        """A per-grant cap bounds one reader; it does not bound a hundred."""
        self.ask(question="short")

        other = User.objects.create_user(
            email="other@example.com", phone="+919111111111",
            full_name="Other", password="x")
        Order.objects.create(user=other, book=self.book, pace="medium")
        other_grant = TemporalGrant.objects.create(user=other, chapter=self.chapter)

        response = self.client.post(
            "/api/chat",
            {"token": other_grant.token, "question": "short"},
            content_type="application/json")

        self.assertEqual(response.status_code, 429)


class UnconfiguredTests(Base):
    @override_settings(COMPANION_MODEL="claude-sonnet-5", ANTHROPIC_API_KEY="")
    def test_without_a_key_the_companion_is_unavailable_not_faked(self):
        """A fake companion is worse than an absent one — the reader would
        believe they had talked to something."""
        self.assertEqual(self.ask().status_code, 503)
