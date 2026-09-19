"""The three seams, called directly.

No test client anywhere in this file. If a seam needs one, the layering has
already failed (BUILD.md S5).
"""

from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from core.models import (
    Book,
    Chapter,
    MessageLog,
    Order,
    PasswordResetToken,
    TemporalGrant,
    User,
)
from core.services import access, grants
from core.services.onboarding import OnboardingRefused, create_reader


def a_book(slug="the-book"):
    book = Book.objects.create(title="The Sapien Paradox", slug=slug, price_cents=190000)
    for index in (1, 2):
        Chapter.objects.create(
            book=book, order_index=index, title=f"Chapter {index}", file=f"c{index}.pdf"
        )
    return book


def a_reader(email="ada@example.com", phone="+919876543210"):
    return User.objects.create_user(email=email, full_name="Ada", phone=phone,
                                    password="pw")


class CanReadTests(TestCase):
    def setUp(self):
        self.book = a_book()
        self.chapter = self.book.chapters.first()
        self.reader = a_reader()

    def test_an_owner_may_read(self):
        Order.objects.create(user=self.reader, book=self.book, pace="medium")

        self.assertTrue(access.can_read(self.reader, self.chapter))

    def test_a_non_owner_may_not(self):
        self.assertFalse(access.can_read(self.reader, self.chapter))

    def test_an_anonymous_visitor_may_not(self):
        self.assertFalse(access.can_read(None, self.chapter))

    def test_ownership_is_per_book_not_per_chapter(self):
        Order.objects.create(user=self.reader, book=self.book, pace="medium")

        for chapter in self.book.chapters.all():
            self.assertTrue(access.can_read(self.reader, chapter))


class GrantTests(TestCase):
    def setUp(self):
        self.book = a_book()
        self.chapter = self.book.chapters.first()
        self.reader = a_reader()

    def test_validate_returns_a_live_grant(self):
        grant = TemporalGrant.objects.create(user=self.reader, chapter=self.chapter)

        self.assertEqual(grants.validate(grant.token), grant)

    def test_validate_refuses_an_expired_token(self):
        grant = TemporalGrant.objects.create(
            user=self.reader,
            chapter=self.chapter,
            expires_at=timezone.now() - timedelta(days=1),
        )

        self.assertIsNone(grants.validate(grant.token))

    def test_validate_refuses_an_unknown_token(self):
        self.assertIsNone(grants.validate("nope"))

    def test_mint_or_reuse_reuses_a_live_grant(self):
        first = grants.mint_or_reuse(self.reader, self.chapter)

        second = grants.mint_or_reuse(self.reader, self.chapter)

        self.assertEqual(first, second)
        self.assertEqual(TemporalGrant.objects.count(), 1)

    def test_mint_or_reuse_mints_when_the_only_grant_expired(self):
        TemporalGrant.objects.create(
            user=self.reader,
            chapter=self.chapter,
            expires_at=timezone.now() - timedelta(days=1),
        )

        fresh = grants.mint_or_reuse(self.reader, self.chapter)

        self.assertTrue(fresh.expires_at > timezone.now())
        self.assertEqual(TemporalGrant.objects.count(), 2)

    def test_reissue_leaves_the_old_token_dead(self):
        old = TemporalGrant.objects.create(
            user=self.reader,
            chapter=self.chapter,
            expires_at=timezone.now() - timedelta(days=1),
        )

        fresh = grants.reissue(old)

        old.refresh_from_db()
        self.assertNotEqual(fresh.token, old.token)
        self.assertIsNone(grants.validate(old.token))


class CreateReaderTests(TestCase):
    def setUp(self):
        self.book = a_book()

    def submit(self, email="ada@example.com", phone="+919876543210", book=None):
        return create_reader(
            full_name="Ada",
            email=email,
            phone=phone,
            book=book or self.book,
            pace="medium",
        )

    def test_a_new_reader_gets_a_user_an_order_and_a_grant(self):
        result = self.submit()

        self.assertTrue(result.created)
        self.assertEqual(User.objects.count(), 1)
        self.assertEqual(Order.objects.count(), 1)
        self.assertEqual(result.grant.chapter.order_index, 1)

    def test_the_new_reader_cannot_log_in_until_they_set_a_password(self):
        result = self.submit()

        self.assertFalse(result.user.has_usable_password())
        self.assertIsNotNone(result.reset_token)

    def test_chapter_one_is_delivered_and_the_result_carries_the_log(self):
        result = self.submit()

        self.assertEqual(result.chapter_message.status, MessageLog.SENT)
        self.assertEqual(result.chapter_message.grant, result.grant)

    def test_a_returning_reader_buying_another_book_is_normal(self):
        self.submit()
        other = a_book(slug="second-book")

        result = self.submit(book=other)

        self.assertFalse(result.created)
        self.assertEqual(User.objects.count(), 1)
        self.assertEqual(Order.objects.count(), 2)

    def test_buying_the_same_book_twice_is_refused(self):
        self.submit()

        with self.assertRaises(OnboardingRefused) as caught:
            self.submit()

        self.assertEqual(caught.exception.reason, "already_owns_book")

    def test_a_known_email_with_a_new_phone_is_refused_naming_the_field(self):
        self.submit()

        with self.assertRaises(OnboardingRefused) as caught:
            self.submit(phone="+910000000000", book=a_book(slug="third"))

        self.assertEqual(caught.exception.reason, "partial_identity_match")
        self.assertEqual(caught.exception.field, "phone")

    def test_a_known_phone_with_a_new_email_is_refused(self):
        self.submit()

        with self.assertRaises(OnboardingRefused) as caught:
            self.submit(email="grace@example.com", book=a_book(slug="fourth"))

        self.assertEqual(caught.exception.field, "email")

    def test_fields_pointing_at_two_readers_are_refused(self):
        self.submit()
        self.submit(email="grace@example.com", phone="+911111111111",
                    book=a_book(slug="fifth"))

        with self.assertRaises(OnboardingRefused) as caught:
            self.submit(email="ada@example.com", phone="+911111111111",
                        book=a_book(slug="sixth"))

        self.assertEqual(caught.exception.reason, "identity_belongs_to_two_readers")

    def test_a_refusal_creates_nothing(self):
        self.submit()
        before = Order.objects.count()

        with self.assertRaises(OnboardingRefused):
            self.submit()

        self.assertEqual(Order.objects.count(), before)


class SetPasswordDeliveryTests(TestCase):
    """Who is sent a set-a-password link, and who is not.

    The gate used to be `created`, so a reader who bought once, never set a
    password, and came back was skipped — the one message that could let them in
    was the one withheld.
    """

    def setUp(self):
        self.book = a_book()
        self.second = a_book(slug="second-book")

    def submit(self, book=None):
        return create_reader(
            full_name="Ada",
            email="ada@example.com",
            phone="+919876543210",
            book=book or self.book,
            pace="medium",
        )

    def test_a_new_reader_is_sent_one(self):
        result = self.submit()

        self.assertIsNotNone(result.reset_token)
        self.assertEqual(result.password_message.template_key, "set_password")

    def test_a_returning_reader_who_never_set_a_password_is_sent_one(self):
        self.submit()

        result = self.submit(book=self.second)

        self.assertFalse(result.created)
        self.assertFalse(result.user.has_usable_password())
        self.assertIsNotNone(result.password_message)
        self.assertEqual(result.password_message.template_key, "set_password")

    def test_a_reader_who_already_has_a_password_is_not(self):
        first = self.submit()
        first.user.set_password("longenough")
        first.user.save(update_fields=["password"])

        result = self.submit(book=self.second)

        self.assertIsNone(result.password_message)

    def test_no_token_is_minted_for_a_reader_who_has_a_password(self):
        """An unsent token would throttle their next 'send me a link' (D31)."""
        first = self.submit()
        first.user.set_password("longenough")
        first.user.save(update_fields=["password"])

        before = PasswordResetToken.objects.count()
        result = self.submit(book=self.second)

        self.assertIsNone(result.reset_token)
        self.assertEqual(PasswordResetToken.objects.count(), before)
