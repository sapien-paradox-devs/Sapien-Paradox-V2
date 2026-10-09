"""What a reader sees and may do while cadence still holds a chapter (#114).

Cadence 1 mints the schedule and Cadence 2 fires it; this is the half the reader
meets. Three claims: Home lists a locked chapter with its date, `/read` refuses
one with its own code rather than minting a token nobody was sent, and the same
refusal covers send-to-WhatsApp.
"""

from django.test import TestCase, override_settings
from django.urls import reverse

from core.models import Book, Chapter, MessageLog, TemporalGrant, User
from core.services import access
from core.services.onboarding import create_reader
from core import selectors


@override_settings(
    PACE_DELAY_DAYS={"slow": 7, "medium": 3, "fast": 1},
    CADENCE_DELIVERY_HOUR=8,
    CADENCE_TIMEZONE="Asia/Kolkata",
)
class LockedChapterTests(TestCase):
    """One reader, one four-chapter book: chapter 1 live, chapters 2–4 scheduled."""

    def setUp(self):
        self.book = Book.objects.create(title="The Sapien Paradox", slug="the-book")
        self.chapters = [
            Chapter.objects.create(
                book=self.book, order_index=index, title=f"Chapter {index}", file=f"c{index}.pdf"
            )
            for index in range(1, 5)
        ]
        self.reader = create_reader(
            full_name="Ada Lovelace",
            email="ada@example.com",
            phone="+919876543210",
            book=self.book,
            pace="medium",
        ).user
        self.client.force_login(self.reader)

    def chapter(self, number):
        return self.chapters[number - 1]

    def home(self):
        return self.client.get(reverse("api:home")).json()

    # ── the selector ─────────────────────────────────────────────────────────

    def test_only_scheduled_chapters_are_locked(self):
        locks = selectors.locks_by_chapter(self.reader)

        self.assertNotIn(self.chapter(1).pk, locks)
        for number in (2, 3, 4):
            self.assertTrue(locks[self.chapter(number).pk].locked)

    def test_a_lock_carries_the_moment_the_tick_will_release_it(self):
        locks = selectors.locks_by_chapter(self.reader)
        second, third = self.chapter(2).pk, self.chapter(3).pk

        self.assertIsNotNone(locks[second].unlocks_at)
        self.assertLess(locks[second].unlocks_at, locks[third].unlocks_at)

    def test_a_reader_from_before_cadence_holds_no_locks(self):
        """Their rows are `live`, so nothing about this feature reaches them."""
        TemporalGrant.objects.filter(user=self.reader).update(state=TemporalGrant.LIVE)

        self.assertEqual(selectors.locks_by_chapter(self.reader), {})

    # ── GET /api/home ────────────────────────────────────────────────────────

    def test_home_lists_every_chapter_including_the_locked_ones(self):
        rows = self.home()["books"][0]["chapters"]

        self.assertEqual([row["number"] for row in rows], [1, 2, 3, 4])
        self.assertEqual([row["locked"] for row in rows], [False, True, True, True])

    def test_a_locked_row_carries_a_date_and_a_live_row_does_not(self):
        rows = self.home()["books"][0]["chapters"]

        self.assertIsNone(rows[0]["unlocksAt"])
        self.assertTrue(rows[1]["unlocksAt"].startswith("20"))

    def test_home_still_carries_no_token(self):
        """The reason locked rows are safe to list at all (D11, D22)."""
        self.assertNotIn("token", self.client.get(reverse("api:home")).content.decode())

    # ── GET /api/read/{id} ───────────────────────────────────────────────────

    def test_reading_a_live_chapter_is_unaffected(self):
        response = self.client.get(reverse("api:read_chapter", args=[self.chapter(1).pk]))

        self.assertEqual(response.status_code, 200)
        self.assertIn("token", response.json())

    def test_reading_a_locked_chapter_is_refused_with_its_own_code(self):
        response = self.client.get(reverse("api:read_chapter", args=[self.chapter(3).pk]))

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["detail"], access.NOT_UNLOCKED)

    def test_a_refused_read_mints_nothing(self):
        """Otherwise the reader holds a live token for a chapter nobody sent them."""
        before = TemporalGrant.objects.filter(user=self.reader).count()

        self.client.get(reverse("api:read_chapter", args=[self.chapter(3).pk]))

        self.assertEqual(TemporalGrant.objects.filter(user=self.reader).count(), before)
        self.assertEqual(
            TemporalGrant.objects.get(user=self.reader, chapter=self.chapter(3)).state,
            TemporalGrant.SCHEDULED,
        )

    def test_not_yet_and_not_yours_are_different_statuses(self):
        """The whole point of the refusal code: one is a date, one is a dead end."""
        stranger = User.objects.create_user(
            email="bob@example.com", password="x", full_name="Bob"
        )
        self.client.force_login(stranger)

        response = self.client.get(reverse("api:read_chapter", args=[self.chapter(1).pk]))

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["detail"], access.NOT_OWNER)

    # ── POST /api/chapters/{id}/send ─────────────────────────────────────────

    def test_sending_a_locked_chapter_is_refused_the_same_way(self):
        response = self.client.post(reverse("api:send_chapter", args=[self.chapter(2).pk]))

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["detail"], access.NOT_UNLOCKED)

    def test_a_refused_send_delivers_nothing(self):
        before = MessageLog.objects.count()

        self.client.post(reverse("api:send_chapter", args=[self.chapter(2).pk]))

        self.assertEqual(MessageLog.objects.count(), before)

    # ── the seam itself ──────────────────────────────────────────────────────

    def test_can_read_and_refusal_for_agree(self):
        """`can_read` is defined in terms of `refusal_for`, so they cannot drift."""
        for chapter in self.chapters:
            with self.subTest(chapter=chapter.order_index):
                self.assertEqual(
                    access.can_read(self.reader, chapter),
                    access.refusal_for(self.reader, chapter) is None,
                )
