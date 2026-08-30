"""The auth machine. The session has no state column, so nothing is persisted."""

from types import SimpleNamespace

from django.test import TestCase

from core.machines import dispatch
from core.machines.auth import ANONYMOUS, AUTHENTICATED, auth_machine

READER = SimpleNamespace(email="reader@example.com")


class Session:
    def __init__(self, state=ANONYMOUS):
        self.state = state


def deps(user=None, phone_user=None, reset_token=None, requests=0, limit=3):
    calls = SimpleNamespace(logged_in=[], logged_out=0, sent=[], consumed=[])
    d = SimpleNamespace(
        authenticate=lambda email, password: user,
        login=lambda u: calls.logged_in.append(u),
        logout=lambda: setattr(calls, "logged_out", calls.logged_out + 1),
        find_by_phone=lambda phone: phone_user,
        reset_requests_in_window=lambda phone: requests,
        reset_limit=limit,
        mint_reset_token=lambda u: "token-row",
        send_password_reset=lambda t: calls.sent.append(t) or "message-log",
        find_live_reset_token=lambda t: reset_token,
        set_password=lambda u, p: u,
        consume_reset_token=lambda t: calls.consumed.append(t),
    )
    d.calls = calls
    return d


class LoginTests(TestCase):
    def test_valid_credentials_authenticate_and_open_a_session(self):
        d = deps(user=READER)

        result = dispatch(auth_machine, Session(), "LOGIN", deps=d,
                          email="a@b.c", password="pw")

        self.assertTrue(result.ok)
        self.assertEqual(result.state, AUTHENTICATED)
        self.assertEqual(d.calls.logged_in, [READER])

    def test_bad_credentials_refuse_with_their_own_code(self):
        result = dispatch(auth_machine, Session(), "LOGIN", deps=deps(user=None),
                          email="a@b.c", password="wrong")

        self.assertFalse(result.ok)
        self.assertEqual(result.refusal, "bad_credentials")
        self.assertEqual(result.state, ANONYMOUS)

    def test_bad_credentials_never_open_a_session(self):
        d = deps(user=None)

        dispatch(auth_machine, Session(), "LOGIN", deps=d, email="a@b.c", password="x")

        self.assertEqual(d.calls.logged_in, [])


class LogoutTests(TestCase):
    def test_logout_returns_to_anonymous(self):
        d = deps()

        result = dispatch(auth_machine, Session(AUTHENTICATED), "LOGOUT", deps=d)

        self.assertTrue(result.ok)
        self.assertEqual(result.state, ANONYMOUS)
        self.assertEqual(d.calls.logged_out, 1)


class ResetRequestTests(TestCase):
    def test_a_known_phone_is_sent_a_link(self):
        d = deps(phone_user=READER)

        result = dispatch(auth_machine, Session(), "RESET_REQUEST", deps=d,
                          phone="+919876543210")

        self.assertTrue(result.ok)
        self.assertEqual(d.calls.sent, ["token-row"])

    def test_an_unknown_phone_gets_the_same_answer_and_no_message(self):
        """Otherwise this endpoint tells you who has an account."""
        d = deps(phone_user=None)

        result = dispatch(auth_machine, Session(), "RESET_REQUEST", deps=d,
                          phone="+910000000000")

        self.assertTrue(result.ok)
        self.assertIsNone(result.refusal)
        self.assertEqual(d.calls.sent, [])

    def test_over_the_limit_sends_nothing_and_still_says_nothing(self):
        d = deps(phone_user=READER, requests=3, limit=3)

        result = dispatch(auth_machine, Session(), "RESET_REQUEST", deps=d,
                          phone="+919876543210")

        self.assertTrue(result.ok)
        self.assertEqual(d.calls.sent, [])

    def test_the_request_never_leaves_anonymous(self):
        result = dispatch(auth_machine, Session(), "RESET_REQUEST",
                          deps=deps(phone_user=READER), phone="+91")

        self.assertEqual(result.state, ANONYMOUS)


class ResetConfirmTests(TestCase):
    def test_a_live_token_sets_the_password_and_signs_the_reader_in(self):
        token = SimpleNamespace(user=READER)
        d = deps(reset_token=token)

        result = dispatch(auth_machine, Session(), "RESET_CONFIRM", deps=d,
                          token="t", password="new")

        self.assertTrue(result.ok)
        self.assertEqual(result.state, AUTHENTICATED)
        self.assertEqual(d.calls.logged_in, [READER])

    def test_the_token_is_consumed_so_it_cannot_be_reused(self):
        token = SimpleNamespace(user=READER)
        d = deps(reset_token=token)

        dispatch(auth_machine, Session(), "RESET_CONFIRM", deps=d,
                 token="t", password="new")

        self.assertEqual(d.calls.consumed, [token])

    def test_a_dead_token_refuses(self):
        result = dispatch(auth_machine, Session(), "RESET_CONFIRM",
                          deps=deps(reset_token=None), token="t", password="new")

        self.assertFalse(result.ok)
        self.assertEqual(result.refusal, "reset_token_invalid")
