"""Password reset over WhatsApp (D16, D21).

The two that matter: an unknown phone must be indistinguishable from a known
one, and a token must work exactly once.
"""

from datetime import timedelta

from django.test import TestCase, override_settings
from django.utils import timezone

from core.models import PasswordResetToken, User


@override_settings(WHATSAPP_BACKEND="console")
class ResetRequestTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="reader@example.com", phone="+919000000000",
            full_name="Ada Demo", password="old-password")

    def post(self, phone):
        return self.client.post("/api/auth/reset/request", {"phone": phone},
                                content_type="application/json")

    def test_a_known_phone_gets_a_token(self):
        response = self.post("+919000000000")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(PasswordResetToken.objects.filter(user=self.user).count(), 1)

    def test_an_unknown_phone_answers_IDENTICALLY(self):
        """Otherwise this endpoint tells a stranger who has an account."""
        known = self.post("+919000000000")
        unknown = self.post("+910000000000")

        self.assertEqual(known.status_code, unknown.status_code)
        self.assertEqual(known.json(), unknown.json())

    def test_an_unknown_phone_creates_nothing(self):
        self.post("+910000000000")
        self.assertEqual(PasswordResetToken.objects.count(), 0)

    def test_a_second_request_inside_the_window_is_silently_throttled(self):
        """Still a 200 — telling the caller they were throttled would leak that
        the number is real."""
        self.post("+919000000000")
        second = self.post("+919000000000")

        self.assertEqual(second.status_code, 200)
        self.assertEqual(PasswordResetToken.objects.count(), 1)

    @override_settings(RESET_REQUEST_COOLDOWN_MINUTES=0)
    def test_the_window_is_configurable(self):
        self.post("+919000000000")
        self.post("+919000000000")
        self.assertEqual(PasswordResetToken.objects.count(), 2)


class ResetConfirmTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="reader@example.com", phone="+919000000000",
            full_name="Ada Demo", password="old-password")
        self.token = PasswordResetToken.objects.create(user=self.user)

    def post(self, token=None, password="a-new-password"):
        return self.client.post(
            "/api/auth/reset/confirm",
            {"token": token or self.token.token, "password": password},
            content_type="application/json")

    def test_it_sets_the_password(self):
        response = self.post()

        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("a-new-password"))

    def test_the_reader_can_then_sign_in(self):
        """The whole point: D26 gives a paying reader an unusable password."""
        self.post()

        login = self.client.post(
            "/api/auth/login",
            {"email": "reader@example.com", "password": "a-new-password"},
            content_type="application/json")

        self.assertEqual(login.status_code, 200)

    def test_a_token_works_exactly_ONCE(self):
        """Reset links sit in WhatsApp history forever. A reusable one is a
        permanent account key (D21)."""
        self.post()
        again = self.post(password="another-password")

        self.assertEqual(again.status_code, 410)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("a-new-password"))

    def test_an_expired_token_is_refused(self):
        self.token.expires_at = timezone.now() - timedelta(minutes=1)
        self.token.save(update_fields=["expires_at"])

        self.assertEqual(self.post().status_code, 410)

    def test_an_unknown_token_answers_like_an_expired_one(self):
        """None of these are recoverable here, and distinguishing them tells a
        stranger which tokens were ever real."""
        unknown = self.post(token="not-a-real-token")
        self.assertEqual(unknown.status_code, 410)

    def test_a_short_password_is_refused_without_consuming_the_token(self):
        short = self.post(password="abc")

        self.assertEqual(short.status_code, 422)
        self.token.refresh_from_db()
        self.assertIsNone(self.token.used_at)
