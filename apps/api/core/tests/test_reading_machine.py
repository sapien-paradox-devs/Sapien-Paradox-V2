"""The reading machine, one test per row of its table.

No database and no network: the machine takes its dependencies through
`ctx.deps`, so a grant here is a plain stub (D37).
"""

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from django.test import TestCase

from core.machines import dispatch
from core.machines.reading import LIVE, OPENED, SCHEDULED, reading_machine

NOW = datetime(2026, 8, 30, 12, 0, tzinfo=timezone.utc)


class Grant:
    """Stands in for a TemporalGrant."""

    def __init__(self, state=LIVE, expires_in=timedelta(days=7), unlock_at=None,
                 opened_at=None, video="videos/ch1.mp4"):
        self.state = state
        self.expires_at = NOW + expires_in
        self.unlock_at = unlock_at
        self.opened_at = opened_at
        self.user = "reader"
        self.chapter = SimpleNamespace(video=video)


def deps(owns=True, sent=True, minted="fresh-grant", calls=None):
    calls = calls if calls is not None else []
    return SimpleNamespace(
        now=lambda: NOW,
        can_read=lambda user, chapter: owns,
        send_chapter=lambda grant: SimpleNamespace(status="sent" if sent else "failed"),
        mint_grant=lambda user, chapter: minted,
        record_progress=lambda user, chapter, furthest: calls.append(("record", furthest)),
        complete_chapter=lambda user, chapter: calls.append(("complete",)),
        video_url=lambda chapter: f"https://signed.example/{chapter.video}",
    )


def send(grant, event, payload=None, **kw):
    return dispatch(reading_machine, grant, event, deps=deps(**kw), **(payload or {}))


class OpenTests(TestCase):
    def test_a_live_owned_grant_opens(self):
        result = send(Grant(), "OPEN")

        self.assertTrue(result.ok)
        self.assertEqual(result.state, OPENED)

    def test_opening_stamps_the_first_open(self):
        grant = Grant()

        send(grant, "OPEN")

        self.assertEqual(grant.opened_at, NOW)

    def test_reopening_is_idempotent_and_keeps_the_original_stamp(self):
        first_open = NOW - timedelta(days=1)
        grant = Grant(state=OPENED, opened_at=first_open)

        result = send(grant, "OPEN")

        self.assertTrue(result.ok)
        self.assertEqual(result.state, OPENED)
        self.assertEqual(grant.opened_at, first_open)

    def test_an_expired_grant_refuses_with_its_own_code(self):
        result = send(Grant(expires_in=timedelta(days=-1)), "OPEN")

        self.assertFalse(result.ok)
        self.assertEqual(result.refusal, "expired")

    def test_a_grant_the_reader_no_longer_owns_refuses_differently(self):
        result = send(Grant(), "OPEN", owns=False)

        self.assertFalse(result.ok)
        self.assertEqual(result.refusal, "not_owner")

    def test_expiry_and_ownership_stay_distinguishable(self):
        """One offers a fresh link, the other has no button that helps (D25)."""
        expired = send(Grant(expires_in=timedelta(days=-1)), "OPEN")
        unowned = send(Grant(), "OPEN", owns=False)

        self.assertNotEqual(expired.refusal, unowned.refusal)

    def test_a_refusal_leaves_the_state_untouched(self):
        grant = Grant(expires_in=timedelta(days=-1))

        send(grant, "OPEN")

        self.assertEqual(grant.state, LIVE)


class ReissueTests(TestCase):
    def test_reissue_mints_a_new_grant_rather_than_reviving_this_one(self):
        grant = Grant(expires_in=timedelta(days=-1))

        result = dispatch(reading_machine, grant, "REISSUE", deps=deps(minted="new"))

        self.assertTrue(result.ok)
        self.assertEqual(result.data, "new")
        self.assertEqual(grant.expires_at, NOW - timedelta(days=1))

    def test_reissue_refuses_when_the_reader_does_not_own_the_book(self):
        result = dispatch(reading_machine, Grant(), "REISSUE", deps=deps(owns=False))

        self.assertFalse(result.ok)
        self.assertEqual(result.refusal, "not_owner")


class UnlockTests(TestCase):
    """Cadence is not built yet, so `scheduled` is unreachable in practice."""

    def test_a_due_grant_is_delivered_and_goes_live(self):
        grant = Grant(state=SCHEDULED, unlock_at=NOW - timedelta(minutes=1))

        result = send(grant, "UNLOCK")

        self.assertTrue(result.ok)
        self.assertEqual(result.state, LIVE)

    def test_a_grant_that_is_not_due_yet_does_nothing(self):
        grant = Grant(state=SCHEDULED, unlock_at=NOW + timedelta(days=1))

        result = send(grant, "UNLOCK")

        self.assertFalse(result.ok)
        self.assertEqual(result.state, SCHEDULED)

    def test_a_failed_send_leaves_the_grant_scheduled_for_the_next_tick(self):
        """The retry is the absence of a transition (D40)."""
        grant = Grant(state=SCHEDULED, unlock_at=NOW - timedelta(minutes=1))

        result = send(grant, "UNLOCK", sent=False)

        self.assertFalse(result.ok)
        self.assertEqual(result.refusal, "delivery_failed")
        self.assertEqual(grant.state, SCHEDULED)

    def test_a_failed_send_is_not_persisted(self):
        grant = Grant(state=SCHEDULED, unlock_at=NOW - timedelta(minutes=1))
        saved = []

        dispatch(reading_machine, grant, "UNLOCK", deps=deps(sent=False),
                 persist=saved.append)

        self.assertEqual(saved, [])


class ProgressTests(TestCase):
    """D70: progress and completion are rows of this table, guarded like OPEN."""

    def test_an_opened_grant_records_progress_without_changing_state(self):
        calls = []
        result = send(Grant(state=OPENED), "RECORD_PROGRESS", {"furthest": 0.4}, calls=calls)

        self.assertTrue(result.ok)
        self.assertEqual(result.state, OPENED)
        self.assertEqual(calls, [("record", 0.4)])

    def test_an_opened_grant_can_be_marked_complete(self):
        calls = []
        result = send(Grant(state=OPENED), "COMPLETE", calls=calls)

        self.assertTrue(result.ok)
        self.assertEqual(calls, [("complete",)])

    def test_an_expired_link_records_nothing(self):
        calls = []
        for event, payload in (("RECORD_PROGRESS", {"furthest": 0.5}), ("COMPLETE", None)):
            result = send(Grant(state=OPENED, expires_in=timedelta(seconds=-1)), event, payload,
                          calls=calls)
            self.assertEqual(result.refusal, "expired")
        self.assertEqual(calls, [])

    def test_a_reader_who_no_longer_owns_the_book_records_nothing(self):
        calls = []
        for event, payload in (("RECORD_PROGRESS", {"furthest": 0.5}), ("COMPLETE", None)):
            result = send(Grant(state=OPENED), event, payload, owns=False, calls=calls)
            self.assertEqual(result.refusal, "not_owner")
        self.assertEqual(calls, [])

    def test_a_scheduled_chapter_cannot_record_progress(self):
        """Nothing to read yet: no row fires, so nothing is written."""
        calls = []
        result = send(Grant(state=SCHEDULED), "RECORD_PROGRESS", {"furthest": 0.5}, calls=calls)

        self.assertFalse(result.ok)
        self.assertEqual(calls, [])


class WatchTests(TestCase):
    """The chapter's video (D76): gated like OPEN, and changes nothing."""

    def test_a_live_owned_grant_gets_a_signed_url(self):
        result = send(Grant(), "WATCH")

        self.assertTrue(result.ok)
        self.assertEqual(result.data, "https://signed.example/videos/ch1.mp4")

    def test_watching_does_not_move_the_grant(self):
        grant = Grant(state=LIVE)

        send(grant, "WATCH")

        self.assertEqual(grant.state, LIVE)
        self.assertIsNone(grant.opened_at)

    def test_an_expired_grant_is_refused_as_expired(self):
        result = send(Grant(expires_in=timedelta(seconds=-1)), "WATCH")

        self.assertFalse(result.ok)
        self.assertEqual(result.refusal, "expired")

    def test_a_chapter_without_a_video_is_refused_as_no_video(self):
        result = send(Grant(video=""), "WATCH")

        self.assertEqual(result.refusal, "no_video")

    def test_an_unowned_book_is_refused_as_not_owner_even_without_a_video(self):
        """A stranger learns nothing about which chapters have videos."""
        result = send(Grant(video=""), "WATCH", owns=False)

        self.assertEqual(result.refusal, "not_owner")
        self.assertIsNone(result.data)
