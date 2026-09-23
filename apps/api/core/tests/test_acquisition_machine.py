"""D26's four identity cases, as rows (D59).

These assertions used to live in `test_seams.py`, against `create_reader`, and
expected `OnboardingRefused` to be raised. The cases are unchanged; what moved is
where they are decided and how a refusal travels — as a code on a
`TransitionResult`, never as an exception (D38).
"""

from django.core.files.base import ContentFile
from django.test import TestCase, override_settings

from core.models import Book, Chapter, Order, User

from ._acquisition import purchase

PDF = b"%PDF-1.7\n%tiny\n%%EOF\n"


def a_book(slug="tsp", title="The Sapien Paradox"):
    book = Book.objects.create(title=title, slug=slug, price_cents=190000, is_published=True)
    Chapter.objects.create(book=book, order_index=1, title="One",
                           file=ContentFile(PDF, name=f"{slug}.pdf"))
    return book


class IdentityCasesTests(TestCase):
    """Case 1 unknown · case 2 exact match · case 3 owns it · case 4 partial."""

    def setUp(self):
        self.book = a_book()

    def test_case_1_a_genuinely_new_reader_is_created(self):
        result = purchase(self.book)

        self.assertTrue(result.ok)
        self.assertEqual(result.state, "fulfilled")
        self.assertTrue(result.data.created)
        self.assertEqual(User.objects.count(), 1)
        self.assertEqual(Order.objects.count(), 1)

    def test_case_2_a_returning_reader_buying_another_book_is_normal(self):
        purchase(self.book)
        second = a_book(slug="second-book", title="Second")

        result = purchase(second)

        self.assertTrue(result.ok)
        self.assertFalse(result.data.created)
        self.assertEqual(User.objects.count(), 1)
        self.assertEqual(Order.objects.count(), 2)

    def test_case_3_buying_the_same_book_twice_is_refused(self):
        purchase(self.book)

        result = purchase(self.book)

        self.assertFalse(result.ok)
        self.assertEqual(result.refusal, "already_owns_book")
        self.assertEqual(Order.objects.count(), 1)

    def test_case_4_a_known_email_with_a_new_phone_is_refused(self):
        purchase(self.book)

        result = purchase(a_book(slug="third", title="Third"), phone="+910000000000")

        self.assertEqual(result.refusal, "partial_identity_match")

    def test_case_4_a_known_phone_with_a_new_email_is_refused(self):
        purchase(self.book)

        result = purchase(a_book(slug="fourth", title="Fourth"),
                          email="grace@example.com")

        self.assertEqual(result.refusal, "partial_identity_match")

    def test_fields_pointing_at_two_readers_are_refused_distinctly(self):
        """Kept distinct from partial_identity_match: the frontend differs."""
        purchase(self.book)
        purchase(a_book(slug="fifth", title="Fifth"),
                 email="grace@example.com", phone="+911111111111")

        result = purchase(a_book(slug="sixth", title="Sixth"),
                          email="ada@example.com", phone="+911111111111")

        self.assertEqual(result.refusal, "identity_belongs_to_two_readers")

    def test_a_refusal_creates_nothing(self):
        purchase(self.book)
        before = User.objects.count(), Order.objects.count()

        purchase(a_book(slug="seventh", title="Seventh"), phone="+910000000000")

        self.assertEqual((User.objects.count(), Order.objects.count()), before)


class OrderingTests(TestCase):
    """The row order is part of the logic."""

    def setUp(self):
        self.book = a_book()

    def test_a_replayed_payment_is_a_duplicate_not_a_second_reader(self):
        purchase(self.book, payment_reference="plink_A")

        result = purchase(self.book, payment_reference="plink_A")

        self.assertEqual(result.refusal, "duplicate")
        self.assertEqual(Order.objects.count(), 1)

    def test_owning_the_book_is_checked_before_the_plain_exact_match(self):
        """Otherwise a returning reader is silently charged twice."""
        purchase(self.book)

        result = purchase(self.book)

        self.assertEqual(result.refusal, "already_owns_book")

    def test_a_slug_we_do_not_sell_is_refused_not_a_crash(self):
        book = a_book(slug="ghost", title="Ghost")
        Book.objects.filter(slug="ghost").delete()

        result = purchase(book)

        self.assertEqual(result.refusal, "unknown_book")


class PhoneNormalisationTests(TestCase):
    def test_two_spellings_do_not_become_two_readers(self):
        """`User.phone` is unique on the string, so without normalising this
        would have created a second account for one person."""
        book, second = a_book(), a_book(slug="b", title="B")
        purchase(book, phone="+918712740175")

        result = purchase(second, phone="8712740175")

        self.assertTrue(result.ok)
        self.assertFalse(result.data.created)
        self.assertEqual(User.objects.count(), 1)


@override_settings(ONBOARDING_ALLOW_PHONE_REUSE=True)
class PhoneReuseTests(TestCase):
    """TEMPORARY — delete with the row in machine.py."""

    def setUp(self):
        self.book = a_book()
        self.second = a_book(slug="second-book", title="Second")

    def test_a_known_phone_with_a_new_email_reuses_that_reader(self):
        first = purchase(self.book)

        again = purchase(self.second, email="someone-else@example.com")

        self.assertTrue(again.ok)
        self.assertFalse(again.data.created)
        self.assertEqual(again.data.user.pk, first.data.user.pk)
        self.assertEqual(User.objects.count(), 1)

    def test_the_readers_email_is_not_silently_rewritten(self):
        first = purchase(self.book)

        purchase(self.second, email="attacker@example.com")

        first.data.user.refresh_from_db()
        self.assertEqual(first.data.user.email, "ada@example.com")

    def test_the_same_book_twice_is_still_refused(self):
        purchase(self.book)

        result = purchase(self.book)

        self.assertEqual(result.refusal, "already_owns_book")


class PhoneReuseIsOffByDefaultTests(TestCase):
    def test_a_known_phone_with_a_new_email_is_refused(self):
        book, second = a_book(), a_book(slug="second-book", title="Second")
        purchase(book)

        result = purchase(second, email="other@example.com")

        self.assertEqual(result.refusal, "partial_identity_match")
