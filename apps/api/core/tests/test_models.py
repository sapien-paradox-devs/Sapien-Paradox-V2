"""One row of each table, plus the constraints that are load-bearing.

The tests worth having here are the ones that would catch a well-meaning "fix": the grant
uniqueness that looks like an oversight, and the token default that V1 got wrong.
"""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone

from core.models import (
    Book,
    Chapter,
    ChatUsage,
    MessageLog,
    Order,
    PasswordResetToken,
    TemporalGrant,
)

User = get_user_model()


def make_user(email="reader@example.com", phone="+919876543210"):
    return User.objects.create_user(email=email, phone=phone, full_name="A Reader", password="pw")


def make_chapter(book=None, order_index=1):
    book = book or Book.objects.create(title="Reinforcement Learning", slug="rl")
    return Chapter.objects.create(
        book=book,
        order_index=order_index,
        title="Multi-Arm Bandits",
        file=SimpleUploadedFile("c.pdf", b"%PDF-1.7 fake", content_type="application/pdf"),
    )


class UserTests(TestCase):
    def test_creates_a_reader(self):
        user = make_user()

        self.assertEqual(str(user), "reader@example.com")
        self.assertTrue(user.check_password("pw"))
        self.assertFalse(user.is_staff)

    def test_phone_is_required(self):
        with self.assertRaises(ValueError):
            User.objects.create_user(email="a@b.com", phone="", full_name="X")

    def test_phone_is_unique(self):
        """Not cosmetic: phone is the account-recovery channel, so two accounts sharing
        one makes 'send me a reset link' ambiguous (D19)."""
        make_user()

        with self.assertRaises(IntegrityError):
            make_user(email="other@example.com")

    def test_superuser_gets_staff(self):
        admin = User.objects.create_superuser(
            email="a@example.com", phone="+911111111111", full_name="Admin", password="pw"
        )

        self.assertTrue(admin.is_staff)
        self.assertTrue(admin.is_superuser)


class BookAndChapterTests(TestCase):
    def test_creates_a_book_with_a_chapter(self):
        chapter = make_chapter()

        self.assertEqual(chapter.book.chapters.count(), 1)
        self.assertFalse(chapter.book.is_published, "books start unpublished (D19)")
        self.assertIsNone(chapter.text_content, "extraction is a separate explicit call")

    def test_chapter_index_is_unique_within_a_book(self):
        chapter = make_chapter()

        with self.assertRaises(IntegrityError):
            make_chapter(book=chapter.book, order_index=1)

    def test_upload_path_is_namespaced_and_unique(self):
        chapter = make_chapter()

        self.assertTrue(chapter.file.name.startswith("chapters/rl/1-"))
        self.assertTrue(chapter.file.name.endswith(".pdf"))


class OrderTests(TestCase):
    def test_one_order_per_user_per_book(self):
        user, chapter = make_user(), make_chapter()
        Order.objects.create(user=user, book=chapter.book, pace="slow")

        with self.assertRaises(IntegrityError):
            Order.objects.create(user=user, book=chapter.book, pace="fast")


class TemporalGrantTests(TestCase):
    def setUp(self):
        self.user = make_user()
        self.chapter = make_chapter()

    def test_token_and_expiry_are_defaulted(self):
        """The default must be a module-level wrapper. V1 used `shortuuid.uuid`
        directly — a bound method — and every insert broke at runtime."""
        grant = TemporalGrant.objects.create(user=self.user, chapter=self.chapter)

        self.assertTrue(grant.token)
        self.assertGreater(grant.expires_at, timezone.now())
        self.assertFalse(grant.is_expired)
        self.assertIsNone(grant.opened_at)
        self.assertIsNone(grant.unlock_at, "cadence seam stays null (D1)")

    def test_tokens_differ_between_grants(self):
        first = TemporalGrant.objects.create(user=self.user, chapter=self.chapter)
        second = TemporalGrant.objects.create(user=self.user, chapter=self.chapter)

        self.assertNotEqual(first.token, second.token)

    def test_a_user_may_hold_several_grants_for_one_chapter(self):
        """DELIBERATE, and it looks like a missing constraint.

        Re-issue mints a NEW row so the old token dies. If (user, chapter) were unique,
        re-issue would extend expiry in place and a forwarded expired link would silently
        come back to life — defeating expiry for exactly the case it exists for (D21)."""
        TemporalGrant.objects.create(user=self.user, chapter=self.chapter)
        TemporalGrant.objects.create(user=self.user, chapter=self.chapter)

        self.assertEqual(
            TemporalGrant.objects.filter(user=self.user, chapter=self.chapter).count(), 2
        )

    def test_expiry_is_detected(self):
        grant = TemporalGrant.objects.create(
            user=self.user, chapter=self.chapter, expires_at=timezone.now() - timedelta(seconds=1)
        )

        self.assertTrue(grant.is_expired)

    def test_str_never_leaks_the_token(self):
        grant = TemporalGrant.objects.create(user=self.user, chapter=self.chapter)

        self.assertNotIn(grant.token, str(grant))


class MessageLogTests(TestCase):
    def test_logs_an_attempt(self):
        user = make_user()
        log = MessageLog.objects.create(
            user=user, template_key="chapter_delivery", to_phone=user.phone
        )

        self.assertEqual(log.status, MessageLog.PENDING)
        self.assertEqual(log.attempts, 0)
        self.assertIsNone(log.sent_at)

    def test_grant_is_optional(self):
        """Password reset is an account message — it has no chapter (D21)."""
        user = make_user()
        log = MessageLog.objects.create(
            user=user, template_key="password_reset", to_phone=user.phone
        )

        self.assertIsNone(log.grant)


class ChatUsageTests(TestCase):
    def test_one_row_per_grant_per_day(self):
        grant = TemporalGrant.objects.create(user=make_user(), chapter=make_chapter())
        today = timezone.now().date()
        ChatUsage.objects.create(grant=grant, date=today)

        with self.assertRaises(IntegrityError):
            ChatUsage.objects.create(grant=grant, date=today)


class PasswordResetTokenTests(TestCase):
    def test_starts_usable_and_expires_sooner_than_a_grant(self):
        user = make_user()
        reset = PasswordResetToken.objects.create(user=user)
        grant = TemporalGrant.objects.create(user=user, chapter=make_chapter())

        self.assertTrue(reset.is_usable)
        self.assertLess(reset.expires_at, grant.expires_at)

    def test_single_use(self):
        reset = PasswordResetToken.objects.create(user=make_user())
        reset.used_at = timezone.now()

        self.assertFalse(reset.is_usable)

    def test_str_never_leaks_the_token(self):
        reset = PasswordResetToken.objects.create(user=make_user())

        self.assertNotIn(reset.token, str(reset))
