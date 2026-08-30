"""The onboarding machine — D26's four identity cases, one test each."""

from types import SimpleNamespace

from django.test import TestCase

from core.machines import dispatch
from core.machines.onboarding import CREATED, NEW, onboarding_machine

ADA = SimpleNamespace(email="ada@example.com")
GRACE = SimpleNamespace(email="grace@example.com")


class Attempt:
    def __init__(self):
        self.state = NEW


def deps(by_email=None, by_phone=None, owns=False):
    calls = SimpleNamespace(created=[], orders=[])
    d = SimpleNamespace(
        find_by_email=lambda e: by_email,
        find_by_phone=lambda p: by_phone,
        owns_book=lambda u, b: owns,
        create_reader=lambda **kw: calls.created.append(kw) or "onboarding-result",
        add_order=lambda **kw: calls.orders.append(kw) or "order",
    )
    d.calls = calls
    return d


def submit(d):
    return dispatch(
        onboarding_machine, Attempt(), "SUBMIT", deps=d,
        full_name="Ada", email="ada@example.com", phone="+919876543210",
        book="the-book", pace="medium",
    )


class OnboardingTests(TestCase):
    def test_an_unknown_identity_creates_a_reader(self):
        d = deps()

        result = submit(d)

        self.assertTrue(result.ok)
        self.assertEqual(result.state, CREATED)
        self.assertEqual(len(d.calls.created), 1)

    def test_a_known_reader_buying_another_book_just_gets_an_order(self):
        """Their most loyal customer must not be the one they cannot onboard."""
        d = deps(by_email=ADA, by_phone=ADA, owns=False)

        result = submit(d)

        self.assertTrue(result.ok)
        self.assertEqual(result.state, CREATED)
        self.assertEqual(len(d.calls.orders), 1)
        self.assertEqual(d.calls.created, [])

    def test_a_known_reader_who_already_owns_the_book_is_refused(self):
        d = deps(by_email=ADA, by_phone=ADA, owns=True)

        result = submit(d)

        self.assertFalse(result.ok)
        self.assertEqual(result.refusal, "duplicate_order")
        self.assertEqual(d.calls.orders, [])

    def test_a_matching_email_with_a_new_phone_is_refused_not_guessed(self):
        """A changed number and a typo'd number look identical to the code."""
        d = deps(by_email=ADA, by_phone=None)

        result = submit(d)

        self.assertFalse(result.ok)
        self.assertEqual(result.refusal, "identity_conflict")

    def test_a_matching_phone_with_a_new_email_is_refused(self):
        d = deps(by_email=None, by_phone=ADA)

        result = submit(d)

        self.assertFalse(result.ok)
        self.assertEqual(result.refusal, "identity_conflict")

    def test_fields_pointing_at_two_different_readers_are_refused(self):
        d = deps(by_email=ADA, by_phone=GRACE)

        result = submit(d)

        self.assertFalse(result.ok)
        self.assertEqual(result.refusal, "identity_conflict")

    def test_a_refusal_creates_nothing(self):
        d = deps(by_email=ADA, by_phone=GRACE)

        submit(d)

        self.assertEqual(d.calls.created, [])
        self.assertEqual(d.calls.orders, [])
