"""The Ninja auth classes (D7, D82).

**Each endpoint declares exactly one. No endpoint accepts both.** An endpoint
that took either would have to decide which identity wins, and that decision
would live in every such endpoint rather than in one place.

  SessionAuth  the SPA, cookie-borne, CSRF enforced (D30)
  StaffAuth    SessionAuth, and the user is staff: the in-app admin (D82)
  GrantAuth    a WhatsApp link, token in the path, CSRF exempt (D29, D30)

`GrantAuth` is what makes the product's main path work: a reader arriving from
WhatsApp has no cookies for our domain at all, often in an in-app browser with
its own cookie jar. The token *is* the credential.
"""

import json
import re

from ninja.errors import HttpError
from ninja.security import HttpBearer  # noqa: F401  (kept for future bearer use)
from ninja.utils import check_csrf

from ..services import grants

# D29 puts the token in the PATH, not the query string, because it is a
# credential and query strings leak into referrer headers and access logs (D22).
# Ninja resolves auth before it parses path parameters, so the token is read
# back off the path here rather than taken as an argument.
_TOKEN_IN_PATH = re.compile(r"/api/grants/(?P<token>[^/]+)")


class SessionAuth:
    """The SPA's logged-in reader. Django's session cookie does the work."""

    def __call__(self, request):
        user = getattr(request, "user", None)
        if user is not None and user.is_authenticated:
            return user
        return None


class GrantAuth:
    """A live grant token, taken from the path.

    Returns the **grant**, not the user, so the endpoint can reach both the
    reader and the chapter without a second query.

    **Expiry is deliberately NOT checked here**, though #64 originally asked for
    it. Authentication answers *who is this*; a token that exists identifies its
    reader whether or not it has expired. Refusing expired tokens at this layer
    collapses them into 401 alongside tokens that were never real — and the
    chamber can then no longer tell "this link has rested", which has a button
    (D9), from "no such link", which does not.

    So this resolves the token and stops. The reading machine decides expiry and
    ownership, and the endpoint maps its refusal codes to 410 and 403 (D38).
    Neither question is answered twice, which is the point of the seams.
    """

    def __call__(self, request):
        match = _TOKEN_IN_PATH.search(request.path)
        if match is not None:
            return grants.find(match.group("token"))

        # `POST /api/chat` carries the token in the BODY rather than the path,
        # because the companion panel is open inside a page that already has it
        # and a token in a POST body never reaches a referrer header or an
        # access log either (D22) -- which is the reason D29 kept it out of the
        # query string. Resolving it here keeps GrantAuth the single place that
        # turns a token into a grant, rather than a second lookup in a handler.
        if request.content_type == "application/json":
            try:
                token = json.loads(request.body or b"{}").get("token", "")
            except (ValueError, TypeError):
                return None
            if token:
                return grants.find(token)

        return None


class StaffAuth(SessionAuth):
    """The in-app admin (D82). A session, and the account is staff.

    A reader's session is not enough, and gets a 401 like an anonymous one: Ninja
    has no "authenticated but not allowed" from an auth class. The admin screens
    only ever run for staff, so the distinction would help nobody.

    **CSRF is checked here, explicitly.** Ninja only checks CSRF for its own
    cookie auth classes, so `SessionAuth` above does not get it, whatever D30 and
    this module's docstring say (tracked separately). A staff session is the
    last place that gap may exist. Safe methods pass; unsafe ones need the
    `X-CSRFToken` header matching the `csrftoken` cookie.
    """

    def __call__(self, request):
        user = super().__call__(request)
        if user is None or not user.is_active or not user.is_staff:
            return None
        if check_csrf(request) is not None:
            raise HttpError(403, "csrf_failed")
        return user


session_auth = SessionAuth()
staff_auth = StaffAuth()
grant_auth = GrantAuth()
