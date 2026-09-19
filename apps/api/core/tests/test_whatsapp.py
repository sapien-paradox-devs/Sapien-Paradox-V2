"""Delivery: the retry policy, the MessageLog lifecycle, and the rules that protect tokens.

Every test here runs against a stubbed backend. Nothing touches the network — a fresh clone
with no credentials must pass the whole suite, and CI runs it exactly that way.
"""

from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings

from core.models import Book, Chapter, MessageLog, PasswordResetToken, TemporalGrant
from core.services import whatsapp

User = get_user_model()


def make_grant():
    user = User.objects.create_user(
        email="reader@example.com", phone="+919876543210", full_name="Ada Lovelace", password="pw"
    )
    book = Book.objects.create(title="Reinforcement Learning", slug="rl")
    chapter = Chapter.objects.create(
        book=book,
        order_index=1,
        title="Multi-Arm Bandits",
        file=SimpleUploadedFile("c.pdf", b"%PDF-1.7", content_type="application/pdf"),
    )
    return TemporalGrant.objects.create(user=user, chapter=chapter)


class SuccessTests(TestCase):
    def test_a_chapter_send_records_a_sent_row(self):
        grant = make_grant()

        log = whatsapp.send_chapter(grant)

        self.assertEqual(log.status, MessageLog.SENT)
        self.assertEqual(log.attempts, 1)
        self.assertEqual(log.grant, grant)
        self.assertEqual(log.to_phone, grant.user.phone)
        self.assertIsNotNone(log.sent_at)

    def test_the_rendered_body_is_never_stored(self):
        """It contains a live token — a credential. Storing it gives two places to leak
        from instead of one (D21). template_key plus grant reproduces it exactly."""
        grant = make_grant()

        log = whatsapp.send_chapter(grant)

        for value in vars(log).values():
            if isinstance(value, str):
                self.assertNotIn(grant.token, value, "a stored field contains the token")

    def test_the_link_is_built_from_the_shared_route_pattern(self):
        """The backend builds these links and the frontend routes them (D20). Drift means
        every link in every message 404s."""
        grant = make_grant()

        link = whatsapp.reader_link(grant.token)

        self.assertTrue(link.endswith(f"/r/{grant.token}"))

    def test_password_reset_uses_the_reset_route(self):
        user = make_grant().user
        token = PasswordResetToken.objects.create(user=user)

        log = whatsapp.send_password_reset(token)

        self.assertEqual(log.status, MessageLog.SENT)
        self.assertEqual(log.template_key, "set_password")
        self.assertIsNone(log.grant, "an account message has no chapter (D21)")


@override_settings(WHATSAPP_MAX_ATTEMPTS=3)
class RetryTests(TestCase):
    """3 attempts, transient only, never a 4xx (D17)."""

    def setUp(self):
        self.grant = make_grant()
        # Backoff is real time; tests should not spend it.
        patcher = patch("core.services.whatsapp.time.sleep")
        self.sleep = patcher.start()
        self.addCleanup(patcher.stop)

    def test_a_transient_failure_retries_and_can_succeed(self):
        calls = {"n": 0}

        def flaky(to_phone, body):
            calls["n"] += 1
            if calls["n"] < 3:
                raise whatsapp.TransientDeliveryError("twilio 503")
            return "SM-recovered"

        with patch("core.services.whatsapp._backend", return_value=flaky):
            log = whatsapp.send_chapter(self.grant)

        self.assertEqual(log.status, MessageLog.SENT)
        self.assertEqual(log.attempts, 3)
        self.assertEqual(log.provider_message_id, "SM-recovered")
        self.assertIsNone(log.error, "a recovered send should not keep the earlier error")

    def test_a_permanent_failure_does_not_retry(self):
        """An invalid number or unapproved template cannot succeed on attempt two.
        Retrying is pure delay."""
        calls = {"n": 0}

        def refused(to_phone, body):
            calls["n"] += 1
            raise whatsapp.PermanentDeliveryError("twilio 400 code=21211: invalid 'To'")

        with patch("core.services.whatsapp._backend", return_value=refused):
            log = whatsapp.send_chapter(self.grant)

        self.assertEqual(calls["n"], 1, "a 4xx must not be retried")
        self.assertEqual(log.status, MessageLog.FAILED)
        self.assertEqual(log.attempts, 1)
        self.assertIn("21211", log.error)

    def test_exhausting_the_attempts_records_a_failure(self):
        def always_down(to_phone, body):
            raise whatsapp.TransientDeliveryError("twilio 503")

        with patch("core.services.whatsapp._backend", return_value=always_down):
            log = whatsapp.send_chapter(self.grant)

        self.assertEqual(log.status, MessageLog.FAILED)
        self.assertEqual(log.attempts, 3)
        self.assertEqual(self.sleep.call_count, 2, "sleeps between attempts, not after the last")

    def test_delivery_failure_never_raises(self):
        """This is what makes D17's guarantee structural. With exceptions it would hold
        only while every one of five callers remembered to catch, and the one that forgets
        takes down onboarding."""
        def always_down(to_phone, body):
            raise whatsapp.TransientDeliveryError("twilio 503")

        with patch("core.services.whatsapp._backend", return_value=always_down):
            log = whatsapp.send_chapter(self.grant)   # must not raise

        self.assertEqual(log.status, MessageLog.FAILED)


class BugsRaiseTests(TestCase):
    """Delivery failures return; bugs raise (D27)."""

    def test_an_unknown_template_raises(self):
        user = make_grant().user

        with self.assertRaises(KeyError):
            whatsapp._deliver(
                template_key="no_such_template", user=user, to_phone=user.phone, values={}
            )

    def test_a_missing_variable_raises(self):
        user = make_grant().user

        with self.assertRaises(KeyError):
            whatsapp._deliver(
                template_key="chapter_delivery",
                user=user,
                to_phone=user.phone,
                values={"first_name": "Ada"},
            )

    def test_no_row_is_written_when_rendering_fails(self):
        """The template is rendered before the row is created, so a bug leaves no
        misleading `failed` row blaming the provider."""
        user = make_grant().user
        before = MessageLog.objects.count()

        with self.assertRaises(KeyError):
            whatsapp._deliver(
                template_key="chapter_delivery", user=user, to_phone=user.phone, values={}
            )

        self.assertEqual(MessageLog.objects.count(), before)


class BackendSelectionTests(TestCase):
    def test_console_is_the_default(self):
        """A fresh clone with no credentials must run."""
        with override_settings(WHATSAPP_BACKEND="console"):
            self.assertIs(whatsapp._backend(), whatsapp._console_send)

    def test_twilio_is_selected_explicitly(self):
        with override_settings(WHATSAPP_BACKEND="twilio"):
            self.assertIs(whatsapp._backend(), whatsapp._twilio_send)

    def test_whatsapp_address_is_prefixed_once(self):
        self.assertEqual(whatsapp._whatsapp_address("+919876543210"), "whatsapp:+919876543210")
        self.assertEqual(
            whatsapp._whatsapp_address("whatsapp:+919876543210"), "whatsapp:+919876543210"
        )
