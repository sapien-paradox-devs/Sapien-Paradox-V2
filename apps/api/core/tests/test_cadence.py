"""Cadence: the schedule minted at purchase, and the tick that fires it (D50)."""

from datetime import datetime, timedelta, timezone as dt_timezone
from types import SimpleNamespace
from unittest.mock import patch
from zoneinfo import ZoneInfo

from django.test import TestCase, override_settings
from django.utils import timezone

from core.models import Book, Chapter, MessageLog, Order, TemporalGrant, User
from core.services import access, cadence, grants
from core.services.onboarding import create_reader

IST = ZoneInfo("Asia/Kolkata")


def a_book(chapters=4):
    book = Book.objects.create(title="The Sapien Paradox", slug="the-book", price_cents=190000)
    for index in range(1, chapters + 1):
        Chapter.objects.create(
            book=book, order_index=index, title=f"Chapter {index}", file=f"c{index}.pdf"
        )
    return book


def buy(book, pace="medium"):
    return create_reader(
        full_name="Ada", email="ada@example.com", phone="+919876543210", book=book, pace=pace
    )


def scheduled():
    return TemporalGrant.objects.filter(state=TemporalGrant.SCHEDULED)


@override_settings(
    PACE_DELAY_DAYS={"slow": 7, "medium": 3, "fast": 1},
    CADENCE_DELIVERY_HOUR=8,
    CADENCE_TIMEZONE="Asia/Kolkata",
)
class UnlockTimeTests(TestCase):
    PURCHASE = datetime(2026, 9, 26, 14, 30, tzinfo=IST)

    def test_the_first_chapter_has_no_unlock_moment(self):
        self.assertIsNone(cadence.unlock_at_for(self.PURCHASE, "fast", 0))

    def test_each_pace_lands_at_eight_in_the_morning(self):
        for pace, days in (("slow", 7), ("medium", 3), ("fast", 1)):
            with self.subTest(pace=pace):
                self.assertEqual(
                    cadence.unlock_at_for(self.PURCHASE, pace, 2),
                    datetime(2026, 9, 26, 8, 0, tzinfo=IST) + timedelta(days=2 * days),
                )

    def test_a_two_am_purchase_does_not_deliver_at_two_am(self):
        purchase = datetime(2026, 9, 26, 2, 0, tzinfo=IST)

        self.assertEqual(
            cadence.unlock_at_for(purchase, "fast", 1), datetime(2026, 9, 27, 8, 0, tzinfo=IST)
        )

    def test_the_day_is_the_readers_day_in_india_not_utc(self):
        """03:00 IST on the 26th is still the 25th in UTC."""
        purchase = datetime(2026, 9, 25, 21, 30, tzinfo=dt_timezone.utc)

        self.assertEqual(
            cadence.unlock_at_for(purchase, "fast", 1), datetime(2026, 9, 27, 8, 0, tzinfo=IST)
        )

    @override_settings(CADENCE_DELIVERY_HOUR=None, PACE_DELAY_DAYS={"fast": 0.01})
    def test_without_the_anchor_unlocks_fall_at_exact_offsets(self):
        """What a test deployment uses to watch a book flow in minutes."""
        self.assertEqual(
            cadence.unlock_at_for(self.PURCHASE, "fast", 3),
            self.PURCHASE + timedelta(days=0.03),
        )


class ScheduleTests(TestCase):
    def setUp(self):
        self.book = a_book(chapters=4)

    def test_a_purchase_mints_the_rest_of_the_book_as_scheduled(self):
        result = buy(self.book)

        self.assertEqual(result.grant.state, TemporalGrant.LIVE)
        self.assertEqual(result.grant.chapter.order_index, 1)
        self.assertEqual(
            sorted(scheduled().values_list("chapter__order_index", flat=True)), [2, 3, 4]
        )

    def test_scheduled_rows_carry_ascending_unlock_moments(self):
        buy(self.book)

        moments = list(scheduled().order_by("chapter__order_index").values_list("unlock_at", flat=True))

        self.assertTrue(all(moments))
        self.assertEqual(moments, sorted(moments))

    def test_scheduling_sends_nothing(self):
        buy(self.book)

        self.assertEqual(MessageLog.objects.filter(template_key="chapter_delivery").count(), 1)

    def test_scheduling_twice_mints_nothing_new(self):
        buy(self.book)
        order = Order.objects.get()

        self.assertEqual(cadence.schedule(order), [])
        self.assertEqual(TemporalGrant.objects.count(), 4)

    def test_positions_not_order_index_values_set_the_schedule(self):
        """A book whose numbering has a gap still unlocks one step at a time."""
        Chapter.objects.filter(book=self.book, order_index=4).update(order_index=9)
        buy(self.book)

        last = scheduled().get(chapter__order_index=9)
        third = scheduled().get(chapter__order_index=3)
        self.assertGreater(last.unlock_at, third.unlock_at)
        self.assertLess(last.unlock_at - third.unlock_at, timedelta(days=4))


class LockedChapterTests(TestCase):
    def setUp(self):
        self.book = a_book(chapters=2)
        buy(self.book)
        self.reader = User.objects.get()
        self.second = self.book.chapters.get(order_index=2)

    def test_a_scheduled_chapter_cannot_be_read(self):
        self.assertFalse(access.can_read(self.reader, self.second))

    def test_the_owner_still_owns_the_book(self):
        self.assertTrue(access.owns(self.reader, self.book))

    def test_mint_or_reuse_never_hands_out_a_scheduled_token(self):
        held = scheduled().get()

        self.assertNotEqual(grants.mint_or_reuse(self.reader, self.second).pk, held.pk)


class TickTests(TestCase):
    def setUp(self):
        self.book = a_book(chapters=3)
        buy(self.book)
        self.reader = User.objects.get()
        self.second = scheduled().get(chapter__order_index=2)
        self.third = scheduled().get(chapter__order_index=3)

    def at_second(self):
        return self.second.unlock_at + timedelta(minutes=1)

    def test_nothing_is_sent_before_its_moment(self):
        result = cadence.tick(now=self.second.unlock_at - timedelta(minutes=1))

        self.assertEqual((result.due, result.sent), (0, 0))
        self.assertEqual(scheduled().count(), 2)

    def test_a_due_grant_goes_live_and_the_next_waits(self):
        result = cadence.tick(now=self.at_second())

        self.assertEqual((result.due, result.sent, result.failed), (1, 1, 0))
        self.second.refresh_from_db()
        self.third.refresh_from_db()
        self.assertEqual(self.second.state, TemporalGrant.LIVE)
        self.assertEqual(self.third.state, TemporalGrant.SCHEDULED)

    def test_the_chapter_is_readable_once_unlocked(self):
        cadence.tick(now=self.at_second())

        self.assertTrue(access.can_read(self.reader, self.second.chapter))

    def test_expiry_counts_from_delivery(self):
        now = self.at_second()
        cadence.tick(now=now)

        self.second.refresh_from_db()
        self.assertEqual(self.second.expires_at, now + timedelta(days=7))

    def test_a_second_tick_sends_nothing_again(self):
        cadence.tick(now=self.at_second())
        result = cadence.tick(now=self.at_second())

        self.assertEqual(result.sent, 0)

    def test_a_late_tick_catches_up(self):
        """An outage delays chapters rather than losing them (D39)."""
        result = cadence.tick(now=self.third.unlock_at + timedelta(days=5))

        self.assertEqual(result.sent, 2)

    def test_a_failed_send_leaves_the_grant_scheduled(self):
        failed = SimpleNamespace(status=MessageLog.FAILED)
        with patch("core.services.whatsapp.send_chapter", return_value=failed):
            result = cadence.tick(now=self.at_second())

        self.assertEqual((result.sent, result.failed), (0, 1))
        self.second.refresh_from_db()
        self.assertEqual(self.second.state, TemporalGrant.SCHEDULED)

    def test_a_deactivated_reader_is_sent_nothing(self):
        User.objects.filter(pk=self.reader.pk).update(is_active=False)
        sends = MessageLog.objects.count()

        result = cadence.tick(now=self.at_second())

        self.assertEqual((result.sent, result.refused), (0, 1))
        self.assertEqual(MessageLog.objects.count(), sends)
        self.second.refresh_from_db()
        self.assertEqual(self.second.state, TemporalGrant.SCHEDULED)

    def test_a_row_already_unlocked_by_another_tick_is_skipped(self):
        """Between our listing and our lock, another tick got there first."""
        real_due = cadence.due

        def due_then_race(now=None):
            ids = list(real_due(now))
            TemporalGrant.objects.filter(pk=self.second.pk).update(state=TemporalGrant.LIVE)
            return TemporalGrant.objects.filter(pk__in=[g.pk for g in ids])

        sends = MessageLog.objects.count()
        with patch.object(cadence, "due", due_then_race):
            result = cadence.tick(now=self.at_second())

        self.assertEqual((result.sent, result.refused), (0, 1))
        self.assertEqual(MessageLog.objects.count(), sends)
