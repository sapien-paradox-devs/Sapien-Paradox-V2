"""Session endpoints and Home.

The mirror of the grant path: a cookie and no token, rather than a token and no
cookie. The last test is the one D7 and #48c actually care about — that the two
never cross.
"""

from django.core.files.base import ContentFile
from django.test import TestCase
from django.utils import timezone

from core.models import Book, Chapter, Order, TemporalGrant, User

PDF = b"%PDF-1.7\n%tiny\n%%EOF\n"


class AuthTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="reader@example.com", phone="+919000000000",
            full_name="Ada Demo", password="a-real-password",
        )

    def test_login_returns_the_reader_and_sets_a_session(self):
        response = self.client.post(
            "/api/auth/login",
            {"email": "reader@example.com", "password": "a-real-password"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            "id": str(self.user.pk), "fullName": "Ada Demo",
            "email": "reader@example.com", "phone": "+919000000000", "avatarSeed": None, "isStaff": False,
        })
        self.assertIn("sessionid", response.cookies)

    def test_a_wrong_password_and_an_unknown_email_are_indistinguishable(self):
        """Telling them apart makes this an account-enumeration oracle."""
        wrong = self.client.post(
            "/api/auth/login",
            {"email": "reader@example.com", "password": "nope"},
            content_type="application/json")
        unknown = self.client.post(
            "/api/auth/login",
            {"email": "nobody@example.com", "password": "nope"},
            content_type="application/json")

        self.assertEqual(wrong.status_code, 401)
        self.assertEqual(unknown.status_code, 401)
        self.assertEqual(wrong.json(), unknown.json())

    def test_me_401s_when_anonymous(self):
        """The root machine boots from this and must never assume anonymous (D44)."""
        self.assertEqual(self.client.get("/api/auth/me").status_code, 401)

    def test_me_returns_the_reader_once_signed_in(self):
        self.client.force_login(self.user)
        response = self.client.get("/api/auth/me")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["email"], "reader@example.com")

    def test_logout_ends_the_session(self):
        self.client.force_login(self.user)
        self.client.post("/api/auth/logout", content_type="application/json")

        self.assertEqual(self.client.get("/api/auth/me").status_code, 401)


class HomeTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="reader@example.com", phone="+919000000000",
            full_name="Ada Demo", password="x",
        )
        self.book = Book.objects.create(title="The Sapien Paradox", slug="tsp", is_published=True)
        self.chapters = [
            Chapter.objects.create(book=self.book, order_index=i, title=f"Chapter {i}",
                                   file=ContentFile(PDF, name=f"c{i}.pdf"))
            for i in (1, 2, 3)
        ]
        Order.objects.create(user=self.user, book=self.book, pace="medium")
        self.client.force_login(self.user)

    def test_home_401s_when_anonymous(self):
        self.client.logout()
        self.assertEqual(self.client.get("/api/home").status_code, 401)

    def test_home_lists_the_books_the_reader_owns(self):
        body = self.client.get("/api/home").json()

        self.assertEqual(len(body["books"]), 1)
        self.assertEqual(body["books"][0]["title"], "The Sapien Paradox")
        self.assertEqual(len(body["books"][0]["chapters"]), 3)

    def test_a_book_the_reader_does_not_own_is_absent(self):
        Book.objects.create(title="Someone Else's Book", slug="other", is_published=True)

        body = self.client.get("/api/home").json()

        self.assertEqual([b["title"] for b in body["books"]], ["The Sapien Paradox"])

    def test_read_is_marked_from_opened_at(self):
        TemporalGrant.objects.create(
            user=self.user, chapter=self.chapters[0], opened_at=timezone.now())

        chapters = self.client.get("/api/home").json()["books"][0]["chapters"]

        self.assertEqual([c["read"] for c in chapters], [True, False, False])

    def test_no_token_appears_anywhere_in_the_payload(self):
        """D11: Home mints on demand. Five credentials in a cached, logged,
        screenshotted response would undo the point of expiry."""
        grant = TemporalGrant.objects.create(user=self.user, chapter=self.chapters[0])

        raw = self.client.get("/api/home").content.decode()

        self.assertNotIn(grant.token, raw)
        self.assertNotIn("token", raw.lower())


class TheTwoAuthClassesNeverCross(TestCase):
    """#48c, and the reason D7 forbids an endpoint accepting both."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="reader@example.com", phone="+919000000000",
            full_name="Ada Demo", password="x")
        book = Book.objects.create(title="B", slug="b", is_published=True)
        self.chapter = Chapter.objects.create(
            book=book, order_index=1, title="One", file=ContentFile(PDF, name="c.pdf"))
        Order.objects.create(user=self.user, book=book, pace="medium")
        self.grant = TemporalGrant.objects.create(user=self.user, chapter=self.chapter)

    def test_a_session_cookie_cannot_open_a_grant_endpoint(self):
        self.client.force_login(self.user)

        response = self.client.get("/api/grants/definitely-not-a-token")

        self.assertEqual(response.status_code, 401)

    def test_a_grant_token_cannot_open_a_session_endpoint(self):
        """No cookie, a perfectly good token, and Home still refuses."""
        response = self.client.get("/api/home", HTTP_AUTHORIZATION=f"Bearer {self.grant.token}")

        self.assertEqual(response.status_code, 401)
