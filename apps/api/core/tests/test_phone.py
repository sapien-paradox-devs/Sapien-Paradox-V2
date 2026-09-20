"""One spelling of a phone number, everywhere (D19).

The bug these pin down: `reset_request` answers identically for a known and an
unknown number so it cannot be an oracle — which means a formatting mismatch is
indistinguishable from success, and sends nothing.
"""

import json

from django.test import Client, TestCase, override_settings

from core.models import PasswordResetToken, User
from core.services.phone import normalize


class NormalizeTests(TestCase):
    def test_a_bare_national_number_gets_the_country_code(self):
        self.assertEqual(normalize("8712740175"), "+918712740175")

    def test_spacing_and_punctuation_do_not_matter(self):
        for raw in ["+91 87127 40175", "+91-87127-40175", "(91) 8712740175"]:
            self.assertEqual(normalize(raw), "+918712740175")

    def test_a_country_code_without_its_plus(self):
        self.assertEqual(normalize("918712740175"), "+918712740175")

    def test_a_national_trunk_zero_is_dropped(self):
        self.assertEqual(normalize("08712740175"), "+918712740175")

    def test_an_international_number_is_left_alone(self):
        self.assertEqual(normalize("+14155238886"), "+14155238886")

    def test_a_whatsapp_address_is_stripped(self):
        self.assertEqual(normalize("whatsapp:+918712740175"), "+918712740175")

    def test_empty_stays_empty(self):
        self.assertEqual(normalize(""), "")
        self.assertEqual(normalize(None), "")

    @override_settings(DEFAULT_COUNTRY_CODE="+44")
    def test_the_country_code_is_configurable(self):
        self.assertEqual(normalize("7700900123"), "+447700900123")


@override_settings(WHATSAPP_BACKEND="console")
class ResetRequestFindsTheReaderTests(TestCase):
    """The reported bug: 'a link is on its way' and nothing arrives."""

    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            email="ada@example.com", phone="+918712740175", full_name="Ada",
        )

    def request_link(self, phone):
        return self.client.post(
            "/api/auth/reset/request", json.dumps({"phone": phone}),
            content_type="application/json")

    def test_the_number_typed_without_a_country_code_still_finds_them(self):
        response = self.request_link("8712740175")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(PasswordResetToken.objects.filter(user=self.user).count(), 1)

    def test_the_number_typed_with_spaces_still_finds_them(self):
        self.request_link("+91 87127 40175")

        self.assertEqual(PasswordResetToken.objects.filter(user=self.user).count(), 1)

    def test_an_unknown_number_still_answers_the_same_and_sends_nothing(self):
        """The no-oracle property must survive normalisation."""
        response = self.request_link("+919999999999")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})
        self.assertEqual(PasswordResetToken.objects.count(), 0)


class OneHumanOneAccountTests(TestCase):
    def test_two_spellings_do_not_become_two_readers(self):
        """`User.phone` is unique on the string, so without normalising this
        would have created a second account for one person."""
        from core.models import Book, Chapter
        from django.core.files.base import ContentFile
        from core.services.onboarding import create_reader, OnboardingRefused

        book = Book.objects.create(title="A", slug="a", price_cents=100, is_published=True)
        Chapter.objects.create(book=book, order_index=1, title="One",
                               file=ContentFile(b"%PDF-1.7\n%%EOF\n", name="a.pdf"))
        second = Book.objects.create(title="B", slug="b", price_cents=100, is_published=True)
        Chapter.objects.create(book=second, order_index=1, title="One",
                               file=ContentFile(b"%PDF-1.7\n%%EOF\n", name="b.pdf"))

        create_reader(full_name="Ada", email="ada@example.com",
                      phone="+918712740175", book=book, pace="medium")

        # Same human, same email, number typed differently.
        result = create_reader(full_name="Ada", email="ada@example.com",
                               phone="8712740175", book=second, pace="medium")

        self.assertFalse(result.created)
        self.assertEqual(User.objects.count(), 1)
