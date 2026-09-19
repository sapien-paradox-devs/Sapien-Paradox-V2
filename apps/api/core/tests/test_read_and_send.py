"""Reading, sending, and sanctuary's one tap.

The three endpoints that make Home's buttons do something.
"""

from datetime import timedelta

from django.core.files.base import ContentFile
from django.test import TestCase, override_settings
from django.utils import timezone

from core.models import Book, Chapter, MessageLog, Order, TemporalGrant, User

PDF = b"%PDF-1.7\n%tiny\n%%EOF\n"


class Base(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="reader@example.com", phone="+919000000000",
            full_name="Ada Demo", password="x")
        self.book = Book.objects.create(title="TSP", slug="tsp", is_published=True)
        self.chapter = Chapter.objects.create(
            book=self.book, order_index=1, title="One",
            file=ContentFile(PDF, name="c1.pdf"))
        Order.objects.create(user=self.user, book=self.book, pace="medium")
        self.client.force_login(self.user)


class ReadTests(Base):
    def test_returns_a_token_for_an_owned_chapter(self):
        response = self.client.get(f"/api/read/{self.chapter.pk}")

        self.assertEqual(response.status_code, 200)
        token = response.json()["token"]
        self.assertTrue(TemporalGrant.objects.filter(token=token).exists())

    def test_is_idempotent_and_does_not_accumulate_tokens(self):
        """D32. Opening the same chapter twice must reuse the live grant."""
        first = self.client.get(f"/api/read/{self.chapter.pk}").json()["token"]
        second = self.client.get(f"/api/read/{self.chapter.pk}").json()["token"]

        self.assertEqual(first, second)
        self.assertEqual(TemporalGrant.objects.filter(user=self.user).count(), 1)

    def test_an_unowned_chapter_is_403(self):
        Order.objects.filter(user=self.user).delete()

        self.assertEqual(self.client.get(f"/api/read/{self.chapter.pk}").status_code, 403)

    def test_anonymous_is_401(self):
        self.client.logout()
        self.assertEqual(self.client.get(f"/api/read/{self.chapter.pk}").status_code, 401)


@override_settings(WHATSAPP_BACKEND="console")
class SendTests(Base):
    def test_sending_delivers_and_logs(self):
        response = self.client.post(f"/api/chapters/{self.chapter.pk}/send",
                                    content_type="application/json")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(
            MessageLog.objects.filter(user=self.user, template_key="chapter_delivery").exists())

    def test_sending_reuses_the_live_grant(self):
        """D27. A button press must not spawn a token each time."""
        self.client.post(f"/api/chapters/{self.chapter.pk}/send", content_type="application/json")
        MessageLog.objects.all().delete()          # clear the cooldown, not the grant
        self.client.post(f"/api/chapters/{self.chapter.pk}/send", content_type="application/json")

        self.assertEqual(TemporalGrant.objects.filter(user=self.user).count(), 1)

    def test_a_second_send_inside_the_window_is_429(self):
        """Which the frontend renders as 'already sent', not an error (D45)."""
        self.client.post(f"/api/chapters/{self.chapter.pk}/send", content_type="application/json")
        again = self.client.post(f"/api/chapters/{self.chapter.pk}/send",
                                 content_type="application/json")

        self.assertEqual(again.status_code, 429)

    @override_settings(CHAPTER_SEND_COOLDOWN_MINUTES=0)
    def test_the_window_is_configurable(self):
        self.client.post(f"/api/chapters/{self.chapter.pk}/send", content_type="application/json")
        again = self.client.post(f"/api/chapters/{self.chapter.pk}/send",
                                 content_type="application/json")

        self.assertEqual(again.status_code, 200)

    def test_an_unowned_chapter_cannot_be_sent(self):
        Order.objects.filter(user=self.user).delete()
        response = self.client.post(f"/api/chapters/{self.chapter.pk}/send",
                                    content_type="application/json")

        self.assertEqual(response.status_code, 403)


@override_settings(WHATSAPP_BACKEND="console")
class ReissueTests(Base):
    def setUp(self):
        super().setUp()
        self.client.logout()            # sanctuary has no session — that is the point
        self.grant = TemporalGrant.objects.create(user=self.user, chapter=self.chapter)

    def test_reissue_works_on_an_EXPIRED_token(self):
        """The entire point of D9. An expired link is the only reason to tap this."""
        self.grant.expires_at = timezone.now() - timedelta(days=1)
        self.grant.save(update_fields=["expires_at"])

        response = self.client.post(f"/api/grants/{self.grant.token}/reissue",
                                    content_type="application/json")

        self.assertEqual(response.status_code, 200)

    def test_it_mints_a_new_row_and_leaves_the_old_token_dead(self):
        """D21. Extending in place would revive a forwarded link."""
        self.grant.expires_at = timezone.now() - timedelta(days=1)
        self.grant.save(update_fields=["expires_at"])

        self.client.post(f"/api/grants/{self.grant.token}/reissue",
                         content_type="application/json")

        self.assertEqual(TemporalGrant.objects.filter(user=self.user).count(), 2)
        self.grant.refresh_from_db()
        self.assertTrue(self.grant.is_expired)          # the old one stays dead

    def test_a_second_tap_inside_the_window_is_429(self):
        self.client.post(f"/api/grants/{self.grant.token}/reissue", content_type="application/json")
        again = self.client.post(f"/api/grants/{self.grant.token}/reissue",
                                 content_type="application/json")

        self.assertEqual(again.status_code, 429)

    def test_an_unknown_token_is_refused(self):
        response = self.client.post("/api/grants/not-a-token/reissue",
                                    content_type="application/json")

        self.assertIn(response.status_code, (401, 404))
