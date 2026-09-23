"""The delivery machine — D27's retry policy, one test per row.

`status` is the state column here, not `state`, so these dispatch with
`state_attr="status"` exactly as the service will.
"""

from types import SimpleNamespace

from django.test import TestCase

from core.machines import dispatch
from core.machines.delivery import FAILED, PENDING, SENT, delivery_machine


class Log:
    """Stands in for a MessageLog. No database — the machine imports no Django."""

    def __init__(self, status=PENDING, attempts=0):
        self.status = status
        self.attempts = attempts
        self.provider_message_id = None
        self.error = None
        self.sent_at = None


def outcome(accepted=False, transient=False, error=None, provider_message_id=None):
    return SimpleNamespace(
        accepted=accepted,
        transient=transient,
        error=error,
        provider_message_id=provider_message_id,
    )


# The cap is injected (D37) — the guard cannot read settings, so the service
# hands `WHATSAPP_MAX_ATTEMPTS` in. Three is the production default.
DEPS = SimpleNamespace(now=lambda: None, max_attempts=lambda: 3)


def attempt(log, result, deps=DEPS):
    return dispatch(
        delivery_machine, log, "ATTEMPT", deps=deps, state_attr="status", outcome=result
    )


class DeliveryTests(TestCase):
    def test_an_accepted_message_is_sent_and_keeps_the_provider_id(self):
        log = Log()

        result = attempt(log, outcome(accepted=True, provider_message_id="SM123"))

        self.assertTrue(result.ok)
        self.assertEqual(result.state, SENT)
        self.assertEqual(log.provider_message_id, "SM123")
        self.assertEqual(log.attempts, 1)

    def test_a_transient_failure_stays_pending_for_another_attempt(self):
        log = Log()

        result = attempt(log, outcome(transient=True, error="timeout"))

        self.assertTrue(result.ok)
        self.assertEqual(result.state, PENDING)
        self.assertEqual(log.attempts, 1)
        self.assertEqual(log.error, "timeout")

    def test_a_permanent_failure_does_not_retry(self):
        """A bad number retried for a year is the drift D27 warned about."""
        log = Log()

        result = attempt(log, outcome(transient=False, error="invalid number"))

        self.assertTrue(result.ok)
        self.assertEqual(result.state, FAILED)

    def test_the_third_transient_failure_gives_up(self):
        log = Log(attempts=3)

        result = attempt(log, outcome(transient=True, error="timeout"))

        self.assertEqual(result.state, FAILED)
        self.assertEqual(log.attempts, 4)

    def test_a_transient_failure_below_the_cap_still_retries(self):
        log = Log(attempts=1)

        result = attempt(log, outcome(transient=True, error="timeout"))

        self.assertEqual(result.state, PENDING)

    def test_the_cap_counts_provider_calls_not_retries(self):
        """`WHATSAPP_MAX_ATTEMPTS = 3` means three calls, not three retries.

        Until this machine was wired, it allowed a fourth: the guard asked
        `attempts < max` where `attempts` is the count *before* the increment, so
        the third failure stayed pending and a fourth call followed. The service
        loop only ever made three. Two copies of one retry policy, disagreeing —
        which is the drift D27 required this table to make impossible, latent
        only because nothing called it.
        """
        log = Log(attempts=2)      # two calls already made

        result = attempt(log, outcome(transient=True, error="timeout"))

        self.assertEqual(result.state, FAILED)
        self.assertEqual(log.attempts, 3)

    def test_a_failure_records_the_provider_error(self):
        log = Log()

        attempt(log, outcome(transient=False, error="21211 invalid To number"))

        self.assertEqual(log.error, "21211 invalid To number")

    def test_a_settled_message_ignores_further_attempts(self):
        log = Log(status=SENT)

        result = attempt(log, outcome(accepted=True))

        self.assertFalse(result.ok)
        self.assertEqual(result.state, SENT)
        self.assertEqual(result.refusal, "no_transition")

    def test_two_transient_failures_then_success_walks_the_whole_table(self):
        log = Log()

        for _ in range(2):
            attempt(log, outcome(transient=True, error="timeout"))
        self.assertEqual(log.status, PENDING)

        result = attempt(log, outcome(accepted=True, provider_message_id="SM9"))

        self.assertEqual(result.state, SENT)
        self.assertEqual(log.attempts, 3)
