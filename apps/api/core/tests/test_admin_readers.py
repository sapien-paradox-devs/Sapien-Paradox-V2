"""The in-app admin's reader API (D82, D80): staff only, CSRF enforced, and
every change goes through a service or the acquisition machine."""

from django.core.files.base import ContentFile
from django.test import Client, TestCase

from core.models import AccountChange, Book, Chapter, MessageLog, Order, TemporalGrant, User
from core.services import access, onboarding

PDF = b"%PDF-1.7\n%fake\n%%EOF\n"


class Fixture(TestCase):
    def setUp(self):
        self.staff = User.objects.create_user(
            email="owner@example.com", phone="+919000000001", full_name="Owner",
            password="pw", is_staff=True,
        )
        self.reader = User.objects.create_user(
            email="reader@example.com", phone="+919000000002", full_name="Ada Reader",
            password="pw",
        )
        self.book = Book.objects.create(title="The Sapien Paradox", slug="tsp", is_published=True)
        self.chapter = Chapter.objects.create(
            book=self.book, order_index=1, title="One", file=ContentFile(PDF, name="c1.pdf"),
        )
        Order.objects.create(user=self.reader, book=self.book, pace="medium")
        self.client.force_login(self.staff)

    def csrf_client(self, user=None):
        """A client that enforces CSRF, as a browser would, with the token set."""
        client = Client(enforce_csrf_checks=True)
        client.force_login(user or self.staff)
        client.get("/api/auth/me")  # issues the csrftoken cookie
        token = client.cookies["csrftoken"].value
        return client, {"HTTP_X_CSRFTOKEN": token}


class AccessTests(Fixture):
    def test_anonymous_gets_401(self):
        self.assertEqual(Client().get("/api/admin/readers").status_code, 401)

    def test_a_reader_session_gets_401(self):
        client = Client()
        client.force_login(self.reader)
        self.assertEqual(client.get("/api/admin/readers").status_code, 401)

    def test_staff_can_list(self):
        response = self.client.get("/api/admin/readers")
        self.assertEqual(response.status_code, 200)
        emails = [r["email"] for r in response.json()["readers"]]
        self.assertIn("reader@example.com", emails)

    def test_me_reports_staff(self):
        self.assertTrue(self.client.get("/api/auth/me").json()["isStaff"])

    def test_an_unsafe_request_without_the_csrf_token_is_refused(self):
        client, _ = self.csrf_client()
        response = client.post(f"/api/admin/readers/{self.reader.pk}/deactivate")
        self.assertEqual(response.status_code, 403)

    def test_an_unsafe_request_with_the_csrf_token_passes(self):
        client, headers = self.csrf_client()
        response = client.post(f"/api/admin/readers/{self.reader.pk}/deactivate", **headers)
        self.assertEqual(response.status_code, 200)


class ListTests(Fixture):
    def test_search_matches_name_email_or_phone(self):
        for term in ("ada", "reader@", "9000000002"):
            rows = self.client.get("/api/admin/readers", {"search": term}).json()["readers"]
            self.assertEqual([r["email"] for r in rows], ["reader@example.com"], term)

    def test_status_filter(self):
        onboarding.deactivate_reader(self.reader)
        rows = self.client.get("/api/admin/readers", {"status": "inactive"}).json()["readers"]
        self.assertEqual([r["email"] for r in rows], ["reader@example.com"])

    def test_detail_lists_owned_books(self):
        body = self.client.get(f"/api/admin/readers/{self.reader.pk}").json()
        self.assertEqual(body["bookCount"], 1)
        self.assertEqual(body["books"][0]["title"], "The Sapien Paradox")


class CreateTests(Fixture):
    def post(self, **fields):
        body = {"fullName": "New Reader", "email": "new@example.com",
                "phone": "+919000000003", "bookSlug": "tsp", "pace": "medium", **fields}
        return self.client.post("/api/admin/readers", body, content_type="application/json")

    def test_a_new_reader_is_created_with_the_book(self):
        response = self.post()
        self.assertEqual(response.status_code, 201)
        user = User.objects.get(email="new@example.com")
        self.assertTrue(Order.objects.filter(user=user, book=self.book).exists())
        self.assertTrue(TemporalGrant.objects.filter(user=user).exists())
        self.assertTrue(AccountChange.objects.filter(user=user, action="created", by=self.staff).exists())

    def test_an_existing_reader_is_given_another_book_not_duplicated(self):
        other = Book.objects.create(title="Second", slug="second", is_published=True)
        Chapter.objects.create(book=other, order_index=1, title="One",
                               file=ContentFile(PDF, name="s1.pdf"))
        response = self.post(fullName="Ada Reader", email="reader@example.com",
                             phone="+919000000002", bookSlug="second")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(User.objects.filter(email="reader@example.com").count(), 1)
        self.assertEqual(self.reader.orders.count(), 2)

    def test_owning_the_book_already_is_a_field_refusal(self):
        response = self.post(email="reader@example.com", phone="+919000000002")
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json(), {"code": "already_owns_book", "field": "bookSlug"})

    def test_email_and_phone_of_two_different_readers_is_refused(self):
        response = self.post(email="reader@example.com", phone="+919000000001")
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["code"], "identity_belongs_to_two_readers")

    def test_an_unknown_book_is_refused(self):
        response = self.post(bookSlug="nope")
        self.assertEqual(response.json(), {"code": "unknown_book", "field": "bookSlug"})


class UpdateTests(Fixture):
    def patch(self, **fields):
        return self.client.patch(f"/api/admin/readers/{self.reader.pk}", fields,
                                 content_type="application/json")

    def test_name_email_and_phone_change(self):
        response = self.patch(fullName="Ada L.", email="ada@example.com", phone="9000000009")
        self.assertEqual(response.status_code, 200)
        self.reader.refresh_from_db()
        self.assertEqual(self.reader.email, "ada@example.com")
        self.assertEqual(self.reader.phone, "+919000000009")  # normalised

    def test_a_taken_email_is_refused_on_the_field(self):
        response = self.patch(email="owner@example.com")
        self.assertEqual(response.json(), {"code": "email_taken", "field": "email"})

    def test_a_taken_phone_is_refused_on_the_field(self):
        response = self.patch(phone="+919000000001")
        self.assertEqual(response.json(), {"code": "phone_taken", "field": "phone"})


class DeactivateTests(Fixture):
    def test_a_deactivated_reader_cannot_log_in_or_read(self):
        self.client.post(f"/api/admin/readers/{self.reader.pk}/deactivate")
        self.reader.refresh_from_db()

        login = Client().post("/api/auth/login", {"email": "reader@example.com", "password": "pw"},
                              content_type="application/json")
        self.assertEqual(login.status_code, 401)
        self.assertFalse(access.can_read(self.reader, self.chapter))
        self.assertTrue(AccountChange.objects.filter(user=self.reader, action="deactivated").exists())

    def test_their_links_stop_working(self):
        grant = TemporalGrant.objects.create(user=self.reader, chapter=self.chapter)
        self.client.post(f"/api/admin/readers/{self.reader.pk}/deactivate")
        self.assertEqual(Client().get(f"/api/grants/{grant.token}").status_code, 403)

    def test_reactivating_restores_access(self):
        self.client.post(f"/api/admin/readers/{self.reader.pk}/deactivate")
        self.client.post(f"/api/admin/readers/{self.reader.pk}/reactivate")
        self.reader.refresh_from_db()
        self.assertTrue(access.can_read(self.reader, self.chapter))

    def test_staff_cannot_deactivate_themselves(self):
        response = self.client.post(f"/api/admin/readers/{self.staff.pk}/deactivate")
        self.assertEqual(response.status_code, 409)


class EraseTests(Fixture):
    def test_personal_data_goes_and_the_order_stays(self):
        MessageLog.objects.create(user=self.reader, template_key="chapter_delivery",
                                  to_phone=self.reader.phone)
        Order.objects.filter(user=self.reader).update(payment_reference="plink_123")

        response = self.client.post(f"/api/admin/readers/{self.reader.pk}/erase")
        self.assertEqual(response.status_code, 200)

        self.reader.refresh_from_db()
        self.assertNotIn("Ada", self.reader.full_name)
        self.assertNotIn("reader@example.com", self.reader.email)
        self.assertNotEqual(self.reader.phone, "+919000000002")
        self.assertFalse(self.reader.is_active)
        self.assertFalse(self.reader.has_usable_password())
        self.assertEqual(MessageLog.objects.get(user=self.reader).to_phone, "")
        # Accounting keeps its row.
        self.assertTrue(Order.objects.filter(user=self.reader, payment_reference="plink_123").exists())
        self.assertTrue(response.json()["isErased"])

    def test_an_erased_reader_cannot_be_reactivated_or_edited(self):
        self.client.post(f"/api/admin/readers/{self.reader.pk}/erase")
        self.assertEqual(
            self.client.post(f"/api/admin/readers/{self.reader.pk}/reactivate").json()["code"], "erased")
        self.assertEqual(
            self.client.patch(f"/api/admin/readers/{self.reader.pk}", {"fullName": "x"},
                              content_type="application/json").json()["code"], "erased")

    def test_two_erased_readers_do_not_collide(self):
        other = User.objects.create_user(email="b@example.com", phone="+919000000004",
                                         full_name="B", password="pw")
        onboarding.erase_reader(self.reader)
        onboarding.erase_reader(other)  # unique email and phone placeholders
        self.assertEqual(User.objects.filter(full_name=onboarding.ERASED_NAME).count(), 2)

    def test_there_is_no_delete(self):
        response = self.client.delete(f"/api/admin/readers/{self.reader.pk}")
        self.assertEqual(response.status_code, 405)
