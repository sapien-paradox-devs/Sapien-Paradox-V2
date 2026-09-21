"""Public checkout and the Razorpay webhook (D47).

The webhook tests are the ones that matter: signature, idempotency, and never
500-ing on a business refusal. Each of those fails quietly if it is wrong.
"""

import hashlib
import hmac
import json
from unittest.mock import patch

from django.core.files.base import ContentFile
from django.test import TestCase, override_settings

from core.models import Book, Chapter, MessageLog, Order, TemporalGrant, User

PDF = b"%PDF-1.7\n%tiny\n%%EOF\n"
SECRET = "test-webhook-secret"


def sign(raw: bytes, secret: str = SECRET) -> str:
    return hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()


def paid_event(book_slug="tsp", email="new@example.com", phone="+919111000111",
               payment_ref="plink_TEST0001"):
    return {
        "entity": "event",
        "event": "payment_link.paid",
        "id": "evt_TEST0001",
        "payload": {"payment_link": {"entity": {
            "id": payment_ref, "status": "paid", "amount": 190000, "currency": "INR",
            "notes": {"full_name": "New Reader", "email": email, "phone": phone,
                      "book_slug": book_slug, "pace": "medium"},
        }}},
    }


class Base(TestCase):
    def setUp(self):
        self.book = Book.objects.create(
            title="The Sapien Paradox", slug="tsp", price_cents=190000, is_published=True)
        Chapter.objects.create(book=self.book, order_index=1, title="One",
                               file=ContentFile(PDF, name="c1.pdf"))


class BooksTests(Base):
    def test_lists_published_books_to_anyone(self):
        response = self.client.get("/api/books")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [{
            "slug": "tsp", "title": "The Sapien Paradox",
            "priceMinorUnits": 190000, "chapterCount": 1,
        }])

    def test_an_unpublished_book_is_not_for_sale(self):
        """`is_published` exists so a half-built book is not buyable."""
        Book.objects.create(title="Half Done", slug="half", is_published=False)

        slugs = [b["slug"] for b in self.client.get("/api/books").json()]

        self.assertEqual(slugs, ["tsp"])


@override_settings(RAZORPAY_KEY_ID="rzp_test_x", RAZORPAY_KEY_SECRET="s")
class CheckoutTests(Base):
    def post(self, **over):
        body = {"fullName": "New Reader", "email": "new@example.com",
                "phone": "+919111000111", "bookSlug": "tsp", "pace": "medium"}
        body.update(over)
        return self.client.post("/api/checkout", body, content_type="application/json")

    @patch("core.services.payments.create_link")
    def test_returns_the_hosted_payment_url(self, create_link):
        create_link.return_value = {"short_url": "https://rzp.io/i/abc"}

        response = self.post()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"paymentUrl": "https://rzp.io/i/abc"})

    @patch("core.services.payments.create_link")
    def test_creates_nothing_until_the_money_arrives(self, create_link):
        """An unpaid Order is an entitlement, and can_read would have to start
        asking about payment status (D47)."""
        create_link.return_value = {"short_url": "https://rzp.io/i/abc"}

        self.post()

        self.assertEqual(User.objects.count(), 0)
        self.assertEqual(Order.objects.count(), 0)

    def test_an_unknown_book_is_404(self):
        self.assertEqual(self.post(bookSlug="nope").status_code, 404)

    def test_a_bad_pace_is_refused(self):
        self.assertEqual(self.post(pace="instant").status_code, 422)

    @override_settings(RAZORPAY_KEY_ID="", RAZORPAY_KEY_SECRET="")
    def test_checkout_is_closed_when_unconfigured_rather_than_faked(self):
        """A silent fake payment would leave a reader believing they had bought
        something. 503, loudly."""
        self.assertEqual(self.post().status_code, 503)


@override_settings(RAZORPAY_WEBHOOK_SECRET=SECRET, WHATSAPP_BACKEND="console")
class WebhookTests(Base):
    def post(self, event=None, secret=SECRET, raw=None):
        body = raw if raw is not None else json.dumps(event or paid_event()).encode()
        return self.client.post(
            "/api/payments/webhook", body, content_type="application/json",
            HTTP_X_RAZORPAY_SIGNATURE=sign(body, secret))

    def test_a_valid_event_creates_the_reader(self):
        response = self.post()

        self.assertEqual(response.status_code, 200)
        self.assertTrue(User.objects.filter(email="new@example.com").exists())
        self.assertEqual(Order.objects.count(), 1)

    def test_the_order_records_the_payment_reference(self):
        self.post()
        self.assertEqual(Order.objects.get().payment_reference, "plink_TEST0001")

    def test_a_REPLAYED_event_changes_nothing_and_still_returns_200(self):
        """Razorpay retries on any non-2xx and on timeout. Replying non-2xx to
        an event we already handled makes it retry what worked."""
        self.post()
        again = self.post()

        self.assertEqual(again.status_code, 200)
        self.assertTrue(again.json()["duplicate"])
        self.assertEqual(Order.objects.count(), 1)
        self.assertEqual(User.objects.count(), 1)

    def test_a_bad_signature_is_refused_and_creates_nothing(self):
        response = self.post(secret="not-the-secret")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(User.objects.count(), 0)

    def test_a_tampered_body_is_refused(self):
        raw = json.dumps(paid_event()).encode()
        tampered = raw.replace(b'"amount": 190000', b'"amount": 1')
        response = self.client.post(
            "/api/payments/webhook", tampered, content_type="application/json",
            HTTP_X_RAZORPAY_SIGNATURE=sign(raw))

        self.assertEqual(response.status_code, 400)

    def test_a_reserialised_body_is_refused_because_raw_bytes_matter(self):
        """Semantically identical, different bytes. This is what breaks when a
        framework hands you a parsed dict instead of the body."""
        raw = json.dumps(paid_event()).encode()
        # Different separators -> same meaning, different bytes. The previous
        # version used plain json.dumps and reproduced `raw` exactly, so it
        # asserted nothing.
        reserialised = json.dumps(json.loads(raw), separators=(", ", ": "), indent=2).encode()
        response = self.client.post(
            "/api/payments/webhook", reserialised, content_type="application/json",
            HTTP_X_RAZORPAY_SIGNATURE=sign(raw))

        self.assertEqual(response.status_code, 400)

    def test_an_unrelated_event_is_acknowledged_not_processed(self):
        other = paid_event()
        other["event"] = "payment.captured"

        response = self.post(other)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(User.objects.count(), 0)

    def test_buying_the_same_book_twice_is_refused_without_a_500(self):
        """An already-owned book is a fact, not an error to retry."""
        self.post()
        second = paid_event(payment_ref="plink_TEST0002")

        response = self.post(second)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json().get("refused"), "already_owns_book")
        self.assertEqual(Order.objects.count(), 1)


def real_send(to_phone, body):
    """Stands in for Twilio accepting a message. The console backend is not
    delivery, and the tests that assert delivery must not lean on it."""
    return "SMfake0000000000000000000000000000"


def paid_link(payment_ref="plink_TEST0001", status="paid", book_slug="tsp",
              email="new@example.com", phone="+919111000111"):
    """What `payments.fetch_link` returns — the payment-link entity itself."""
    return {
        "id": payment_ref, "status": status, "amount": 190000, "currency": "INR",
        "notes": {"full_name": "New Reader", "email": email, "phone": phone,
                  "book_slug": book_slug, "pace": "medium"},
    }


@override_settings(RAZORPAY_KEY_ID="rzp_test", RAZORPAY_KEY_SECRET="secret",
                   RAZORPAY_WEBHOOK_SECRET=SECRET, WHATSAPP_BACKEND="console")
class ConfirmTests(Base):
    """D48 — the redirect leg fulfils too.

    V1's spike worked because of this path; its run recorded `fulfilled_by: redirect`.
    The webhook needs a public URL, a dashboard entry, a matching secret and an awake
    instance. This needs none of them.
    """

    def post(self, payment_link_id="plink_TEST0001"):
        return self.client.post(
            "/api/checkout/confirm",
            json.dumps({"paymentLinkId": payment_link_id}),
            content_type="application/json",
        )

    @patch("core.services.payments.fetch_link")
    def test_a_paid_link_creates_the_reader(self, fetch):
        fetch.return_value = paid_link()

        response = self.post()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "fulfilled")
        self.assertTrue(User.objects.filter(email="new@example.com").exists())
        self.assertEqual(Order.objects.get().payment_reference, "plink_TEST0001")

    @patch("core.services.payments.fetch_link")
    def test_an_unpaid_link_creates_nothing_and_is_not_an_error(self, fetch):
        """Razorpay can lag. Pending is not failed — the webhook may still land."""
        fetch.return_value = paid_link(status="created")

        response = self.post()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "pending")
        self.assertEqual(User.objects.count(), 0)
        self.assertEqual(Order.objects.count(), 0)

    @patch("core.services.payments.fetch_link")
    def test_the_browsers_id_is_never_taken_as_proof_of_payment(self, fetch):
        """The id selects which link to ask about; Razorpay says whether it was paid."""
        fetch.return_value = paid_link(status="created")

        self.post("plink_FORGED")

        fetch.assert_called_once_with("plink_FORGED")
        self.assertEqual(Order.objects.count(), 0)

    @patch("core.services.payments.fetch_link")
    def test_confirming_twice_fulfils_once(self, fetch):
        fetch.return_value = paid_link()

        self.post()
        again = self.post()

        self.assertEqual(again.json()["status"], "fulfilled")
        self.assertEqual(Order.objects.count(), 1)
        self.assertEqual(User.objects.count(), 1)

    @patch("core.services.payments.fetch_link")
    def test_a_webhook_arriving_after_the_redirect_is_a_no_op(self, fetch):
        """Both legs run in the real world. The second must change nothing."""
        fetch.return_value = paid_link()
        self.post()

        body = json.dumps(paid_event()).encode()
        late = self.client.post("/api/payments/webhook", body,
                                content_type="application/json",
                                HTTP_X_RAZORPAY_SIGNATURE=sign(body))

        self.assertEqual(late.status_code, 200)
        self.assertTrue(late.json()["duplicate"])
        self.assertEqual(Order.objects.count(), 1)

    @patch("core.services.payments.fetch_link")
    def test_a_redirect_arriving_after_the_webhook_is_a_no_op(self, fetch):
        body = json.dumps(paid_event()).encode()
        self.client.post("/api/payments/webhook", body, content_type="application/json",
                         HTTP_X_RAZORPAY_SIGNATURE=sign(body))
        fetch.return_value = paid_link()

        response = self.post()

        self.assertEqual(response.json()["status"], "fulfilled")
        self.assertEqual(Order.objects.count(), 1)

    @patch("core.services.payments.fetch_link")
    def test_owning_the_book_is_reported_as_owned_not_as_a_failure(self, fetch):
        """Still a 200 and still creates nothing — but the reader owns it, and
        that is a state they can act on rather than a dead end."""
        fetch.return_value = paid_link()
        self.post()
        fetch.return_value = paid_link(payment_ref="plink_TEST0002")

        response = self.post("plink_TEST0002")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "owned")
        self.assertEqual(response.json()["detail"], "already_owns_book")
        self.assertEqual(Order.objects.count(), 1)

    @patch("core.services.payments.fetch_link")
    def test_a_lookup_failure_is_502_not_a_silent_success(self, fetch):
        from core.services.payments import PaymentsUnavailable
        fetch.side_effect = PaymentsUnavailable("razorpay refused (404)")

        self.assertEqual(self.post().status_code, 502)
        self.assertEqual(Order.objects.count(), 0)

    @override_settings(RAZORPAY_KEY_ID="", RAZORPAY_KEY_SECRET="")
    def test_confirm_is_closed_when_unconfigured(self):
        self.assertEqual(self.post().status_code, 503)


@override_settings(RAZORPAY_KEY_ID="rzp_test", RAZORPAY_KEY_SECRET="secret",
                   RAZORPAY_WEBHOOK_SECRET=SECRET, WHATSAPP_BACKEND="console")
class ResendTests(Base):
    """Sending the chapter and the set-a-password link again after checkout.

    The signed-in resend in api/read.py cannot serve this reader: D26 leaves them
    unable to log in until the link they are asking for arrives.
    """

    def post(self, payment_link_id="plink_TEST0001"):
        return self.client.post(
            "/api/checkout/resend",
            json.dumps({"paymentLinkId": payment_link_id}),
            content_type="application/json",
        )

    def confirm(self, fetch, **kw):
        fetch.return_value = paid_link(**kw)
        return self.client.post(
            "/api/checkout/confirm", json.dumps({"paymentLinkId": "plink_TEST0001"}),
            content_type="application/json")

    @patch("core.services.whatsapp._backend", return_value=real_send)
    @patch("core.services.payments.fetch_link")
    def test_it_sends_both_again(self, fetch, _backend):
        self.confirm(fetch)
        MessageLog.objects.all().delete()          # clear the cooldown window

        response = self.post()

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["status"], "sent")
        self.assertTrue(body["chapterSent"])
        self.assertTrue(body["passwordSent"])

    @patch("core.services.payments.fetch_link")
    def test_it_does_not_mint_a_second_live_link_for_one_chapter(self, fetch):
        """Two taps must not leave two live tokens (D27)."""
        self.confirm(fetch)
        MessageLog.objects.all().delete()
        before = TemporalGrant.objects.count()

        self.post()

        self.assertEqual(TemporalGrant.objects.count(), before)

    @patch("core.services.payments.fetch_link")
    def test_a_second_press_inside_the_window_is_throttled_not_an_error(self, fetch):
        self.confirm(fetch)

        response = self.post()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "throttled")

    @patch("core.services.payments.fetch_link")
    def test_no_password_link_for_a_reader_who_has_one(self, fetch):
        self.confirm(fetch)
        user = User.objects.get(email="new@example.com")
        user.set_password("longenough")
        user.save(update_fields=["password"])
        MessageLog.objects.all().delete()

        self.assertFalse(self.post().json()["passwordSent"])

    @patch("core.services.payments.fetch_link")
    def test_an_unfulfilled_purchase_is_fulfilled_rather_than_resent(self, fetch):
        """Resending nothing is meaningless — do what they actually wanted."""
        fetch.return_value = paid_link()

        response = self.post()

        self.assertEqual(response.json()["status"], "sent")
        self.assertTrue(User.objects.filter(email="new@example.com").exists())
        self.assertEqual(Order.objects.count(), 1)

    @patch("core.services.payments.fetch_link")
    def test_an_unpaid_link_sends_nothing(self, fetch):
        fetch.return_value = paid_link(status="created")

        self.assertEqual(self.post().json()["status"], "pending")
        self.assertEqual(MessageLog.objects.count(), 0)

    @patch("core.services.payments.fetch_link")
    def test_everything_goes_to_the_phone_on_the_account(self, fetch):
        """Holding the id can make the OWNER receive a message; never the asker."""
        self.confirm(fetch)
        MessageLog.objects.all().delete()

        self.post()

        for row in MessageLog.objects.all():
            self.assertEqual(row.to_phone, "+919111000111")

    @override_settings(RAZORPAY_KEY_ID="", RAZORPAY_KEY_SECRET="")
    def test_resend_is_closed_when_unconfigured(self):
        self.assertEqual(self.post().status_code, 503)


@override_settings(RAZORPAY_KEY_ID="rzp_test", RAZORPAY_KEY_SECRET="secret",
                   RAZORPAY_WEBHOOK_SECRET=SECRET, WHATSAPP_BACKEND="console")
class AlreadyOwnedTests(Base):
    """Owning the book is the easiest case to serve, not a dead end.

    `payment_reference` only matches when the same link is replayed. An order from
    an earlier payment, or from concierge onboarding with no reference, is
    invisible to it — and the replay was then refused for a book the reader owns.
    """

    def confirm(self, payment_link_id="plink_TEST0001"):
        return self.client.post(
            "/api/checkout/confirm", json.dumps({"paymentLinkId": payment_link_id}),
            content_type="application/json")

    def resend(self, payment_link_id="plink_TEST0001"):
        return self.client.post(
            "/api/checkout/resend", json.dumps({"paymentLinkId": payment_link_id}),
            content_type="application/json")

    @patch("core.services.payments.fetch_link")
    def test_a_different_link_for_a_book_already_owned_reports_owned(self, fetch):
        fetch.return_value = paid_link()
        self.confirm()
        Order.objects.update(payment_reference="")      # an order with no reference

        fetch.return_value = paid_link(payment_ref="plink_OTHER")
        response = self.confirm("plink_OTHER")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "owned")
        self.assertEqual(response.json()["detail"], "already_owns_book")

    @patch("core.services.payments.fetch_link")
    def test_it_adopts_the_reference_so_the_next_replay_short_circuits(self, fetch):
        fetch.return_value = paid_link()
        self.confirm()
        Order.objects.update(payment_reference="")

        fetch.return_value = paid_link(payment_ref="plink_OTHER")
        self.confirm("plink_OTHER")

        self.assertEqual(Order.objects.get().payment_reference, "plink_OTHER")

    @patch("core.services.whatsapp._backend", return_value=real_send)
    @patch("core.services.payments.fetch_link")
    def test_owning_the_book_still_lets_you_resend(self, fetch, _backend):
        """The whole point: you own it, so send the links again."""
        fetch.return_value = paid_link()
        self.confirm()
        Order.objects.update(payment_reference="")
        MessageLog.objects.all().delete()

        fetch.return_value = paid_link(payment_ref="plink_OTHER")
        response = self.resend("plink_OTHER")

        self.assertEqual(response.json()["status"], "sent")
        self.assertTrue(response.json()["chapterSent"])

    @patch("core.services.payments.fetch_link")
    def test_it_does_not_create_a_second_order(self, fetch):
        fetch.return_value = paid_link()
        self.confirm()
        Order.objects.update(payment_reference="")

        fetch.return_value = paid_link(payment_ref="plink_OTHER")
        self.confirm("plink_OTHER")

        self.assertEqual(Order.objects.count(), 1)
        self.assertEqual(User.objects.count(), 1)

    @patch("core.services.payments.fetch_link")
    def test_a_genuine_refusal_is_still_a_refusal(self, fetch):
        """partial_identity_match must not be swept into `owned`."""
        fetch.return_value = paid_link()
        self.confirm()

        fetch.return_value = paid_link(payment_ref="plink_OTHER",
                                       email="someone-else@example.com")
        response = self.confirm("plink_OTHER")

        self.assertEqual(response.json()["status"], "refused")
        self.assertEqual(response.json()["detail"], "partial_identity_match")



@override_settings(RAZORPAY_KEY_ID="rzp_test", RAZORPAY_KEY_SECRET="secret",
                   RAZORPAY_WEBHOOK_SECRET=SECRET, WHATSAPP_BACKEND="console")
class ConsoleIsNotDeliveryTests(Base):
    """A deployment with no Twilio credentials prints every message to its own
    log, records `sent`, and told the reader "Sent." Nothing ever existed."""

    @patch("core.services.payments.fetch_link")
    def test_confirm_does_not_claim_delivery_on_the_console_backend(self, fetch):
        fetch.return_value = paid_link()

        response = self.client.post(
            "/api/checkout/confirm", json.dumps({"paymentLinkId": "plink_TEST0001"}),
            content_type="application/json")

        self.assertEqual(response.json()["status"], "fulfilled")   # the reader exists
        self.assertFalse(response.json()["delivered"])              # but nothing left

    @patch("core.services.payments.fetch_link")
    def test_resend_does_not_claim_delivery_on_the_console_backend(self, fetch):
        fetch.return_value = paid_link()
        self.client.post("/api/checkout/confirm", json.dumps({"paymentLinkId": "plink_TEST0001"}),
                         content_type="application/json")
        MessageLog.objects.all().delete()

        response = self.client.post(
            "/api/checkout/resend", json.dumps({"paymentLinkId": "plink_TEST0001"}),
            content_type="application/json")

        self.assertFalse(response.json()["chapterSent"])
        self.assertFalse(response.json()["passwordSent"])

    @patch("core.services.whatsapp._backend", return_value=real_send)
    @patch("core.services.payments.fetch_link")
    def test_a_real_backend_does_claim_delivery(self, fetch, _backend):
        fetch.return_value = paid_link()

        response = self.client.post(
            "/api/checkout/confirm", json.dumps({"paymentLinkId": "plink_TEST0001"}),
            content_type="application/json")

        self.assertTrue(response.json()["delivered"])
