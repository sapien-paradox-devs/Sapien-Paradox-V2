"""Session endpoints — the SPA's own door (D7).

These are the mirror of `grants.py`. A reader here has a cookie and no token; a
reader there has a token and no cookie. **No endpoint accepts both**, so neither
file has to decide which identity wins.

CSRF is **enforced** on the two POSTs (D30). Unlike a grant token, a session
cookie is ambient authority — the browser attaches it to any request to our
origin, including one a third-party page provoked. That is exactly what CSRF
defends against, so it stays on here and stays off there.
"""

from django.contrib.auth import authenticate, login, logout
from django.http import HttpResponse
from django.middleware.csrf import get_token
from ninja import Router
from ninja.errors import HttpError

from ..auth import session_auth
from ..schemas.auth import LoginIn, UserOut

router = Router()


def _as_user_out(user) -> UserOut:
    return UserOut(
        id=str(user.pk),
        fullName=user.full_name,
        email=user.email,
        phone=user.phone,
        avatarSeed=user.avatar_seed,
        isStaff=user.is_staff,
    )


def _hand_over_csrf(request, response: HttpResponse) -> None:
    """Give the SPA the CSRF token in a header as well as the cookie (D30, #176).

    The SPA cannot read a cookie set by another site. While the app and the API
    live on unrelated hosts (`*.vercel.app` and `*.onrender.com`) the `csrftoken`
    cookie is the API's, invisible to the app's script, so without this every
    unsafe request would fail CSRF. The header is exposed through CORS; the
    fetcher keeps it in memory. Once both sit under one parent domain (D6) the
    cookie is readable too, and this still works.
    """
    response["X-CSRFToken"] = get_token(request)


@router.post("/auth/login", response=UserOut, auth=None, url_name="login")
def login_view(request, response: HttpResponse, payload: LoginIn):
    """Email and password, in exchange for a session cookie.

    The same 401 for a bad password and an unknown email: distinguishing them
    turns this into an account-enumeration oracle, and a reader who mistyped
    either is helped by neither.
    """
    user = authenticate(request, username=payload.email, password=payload.password)

    if user is None:
        raise HttpError(401, "invalid_credentials")

    login(request, user)
    # Login rotates the CSRF token; hand the SPA the new one.
    _hand_over_csrf(request, response)
    return _as_user_out(user)


@router.post("/auth/logout", auth=session_auth, url_name="logout")
def logout_view(request):
    logout(request)
    return {"ok": True}


@router.get("/auth/me", response=UserOut, auth=session_auth, url_name="me")
def me(request, response: HttpResponse):
    """Who is this session? The SPA boots from it (D44).

    401 when anonymous, which is the answer the root machine expects — it starts
    in `waiting` and never assumes anonymous before asking.
    """
    # The SPA boots from this, so it is where a reload gets its token back (D30).
    _hand_over_csrf(request, response)
    return _as_user_out(request.auth)
