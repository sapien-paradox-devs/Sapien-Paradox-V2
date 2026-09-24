"""CSRF on session endpoints (D30, #176), and the token reaching an SPA that
cannot read the API's cookie because it lives on another site."""

from django.core.files.base import ContentFile
from django.test import Client, TestCase

from core.models import Book, Chapter, Order, User

PDF = b"%PDF-1.7\n%fake\n%%EOF\n"
APP = "http://localhost:5173"


class Fixture(TestCase):
    def setUp(self):
        self.reader = User.objects.create_user(
            email="reader@example.com", phone="+919000000002", full_name="R", password="pw",
        )
        book = Book.objects.create(title="B", slug="b", is_published=True)
        self.chapter = Chapter.objects.create(book=book, order_index=1, title="One",
                                              file=ContentFile(PDF, name="c.pdf"))
        Order.objects.create(user=self.reader, book=book, pace="medium")

    def browser(self):
        """A client that enforces CSRF the way a browser's requests are checked."""
        client = Client(enforce_csrf_checks=True)
        client.force_login(self.reader)
        return client


class HandOverTests(Fixture):
    def test_me_sends_the_token_in_a_header(self):
        response = self.browser().get("/api/auth/me")
        self.assertTrue(response["X-CSRFToken"])

    def test_login_sends_the_token_in_a_header(self):
        response = Client(enforce_csrf_checks=True).post(
            "/api/auth/login", {"email": "reader@example.com", "password": "pw"},
            content_type="application/json")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response["X-CSRFToken"])

    def test_the_header_is_readable_cross_origin(self):
        """Without Access-Control-Expose-Headers the browser hides it from the app."""
        response = self.browser().get("/api/auth/me", HTTP_ORIGIN=APP)
        self.assertIn("x-csrftoken", response["Access-Control-Expose-Headers"].lower())


class EnforcedTests(Fixture):
    def test_logout_without_the_token_is_refused(self):
        response = self.browser().post("/api/auth/logout")
        self.assertEqual(response.status_code, 403)

    def test_sending_a_chapter_without_the_token_is_refused(self):
        response = self.browser().post(f"/api/chapters/{self.chapter.pk}/send")
        self.assertEqual(response.status_code, 403)

    def test_the_header_token_is_accepted(self):
        client = self.browser()
        token = client.get("/api/auth/me")["X-CSRFToken"]
        response = client.post("/api/auth/logout", HTTP_X_CSRFTOKEN=token)
        self.assertEqual(response.status_code, 200)

    def test_reads_need_no_token(self):
        self.assertEqual(self.browser().get("/api/home").status_code, 200)

    def test_grant_endpoints_stay_exempt(self):
        """A WhatsApp visitor has no cookie at all (D30)."""
        response = Client(enforce_csrf_checks=True).post("/api/grants/nope/reissue")
        self.assertNotEqual(response.status_code, 403)
