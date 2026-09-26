"""Profile endpoints (#217)."""

from django.test import TestCase, override_settings

from core.models import Book, Chapter, Order, User


@override_settings(WHATSAPP_BACKEND="console")
class ProfileTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="ada@example.com", full_name="Ada Demo",
            phone="+919000000000", password="goodpassword",
        )
        self.book = Book.objects.create(title="The Book", slug="tsp")
        Chapter.objects.create(book=self.book, title="One", order_index=1, file="ch/1.pdf")
        Chapter.objects.create(book=self.book, title="Two", order_index=2, file="ch/2.pdf")
        self.order = Order.objects.create(user=self.user, book=self.book, pace="medium")
        self.client.login(email="ada@example.com", password="goodpassword")

    # ── GET /api/profile ─────────────────────────────────────────────────────

    def test_profile_returns_account_and_books(self):
        r = self.client.get("/api/profile")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertEqual(data["fullName"], "Ada Demo")
        self.assertEqual(data["email"], "ada@example.com")
        self.assertEqual(data["phone"], "+919000000000")
        self.assertTrue(data["hasPassword"])
        self.assertIsNone(data["avatarSeed"])
        self.assertEqual(len(data["books"]), 1)
        self.assertEqual(data["books"][0]["title"], "The Book")
        self.assertEqual(data["books"][0]["chaptersTotal"], 2)

    def test_profile_requires_session(self):
        self.client.logout()
        self.assertEqual(self.client.get("/api/profile").status_code, 401)

    # ── PATCH /api/profile ───────────────────────────────────────────────────

    def test_update_name(self):
        r = self.client.patch(
            "/api/profile", {"fullName": "Ada Lovelace"},
            content_type="application/json",
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["fullName"], "Ada Lovelace")
        self.user.refresh_from_db()
        self.assertEqual(self.user.full_name, "Ada Lovelace")

    def test_update_email(self):
        r = self.client.patch(
            "/api/profile", {"email": "new@example.com"},
            content_type="application/json",
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["email"], "new@example.com")

    def test_update_email_clash(self):
        User.objects.create_user(email="taken@example.com", full_name="Other")
        r = self.client.patch(
            "/api/profile", {"email": "taken@example.com"},
            content_type="application/json",
        )
        self.assertEqual(r.status_code, 409)

    def test_update_avatar_seed(self):
        r = self.client.patch(
            "/api/profile", {"avatarSeed": "my-custom-seed"},
            content_type="application/json",
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["avatarSeed"], "my-custom-seed")
        self.user.refresh_from_db()
        self.assertEqual(self.user.avatar_seed, "my-custom-seed")

    # ── POST /api/auth/password ──────────────────────────────────────────────

    def test_change_password(self):
        r = self.client.post(
            "/api/auth/password",
            {"currentPassword": "goodpassword", "newPassword": "newpassword1"},
            content_type="application/json",
        )
        self.assertEqual(r.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("newpassword1"))

    def test_change_password_wrong_current(self):
        r = self.client.post(
            "/api/auth/password",
            {"currentPassword": "wrong", "newPassword": "newpassword1"},
            content_type="application/json",
        )
        self.assertEqual(r.status_code, 403)

    def test_change_password_too_short(self):
        r = self.client.post(
            "/api/auth/password",
            {"currentPassword": "goodpassword", "newPassword": "short"},
            content_type="application/json",
        )
        self.assertEqual(r.status_code, 400)

    def test_change_password_session_survives(self):
        """Changing your password must not log you out (update_session_auth_hash)."""
        self.client.post(
            "/api/auth/password",
            {"currentPassword": "goodpassword", "newPassword": "newpassword1"},
            content_type="application/json",
        )
        r = self.client.get("/api/auth/me")
        self.assertEqual(r.status_code, 200)

    def test_set_first_password_without_current(self):
        """A phone-only reader has no usable password — skip the current field."""
        self.user.set_unusable_password()
        self.user.save()
        # Re-login not possible with unusable password, force session.
        self.client.force_login(self.user)
        r = self.client.post(
            "/api/auth/password",
            {"newPassword": "firstpassword"},
            content_type="application/json",
        )
        self.assertEqual(r.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("firstpassword"))
