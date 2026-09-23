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
        isStaff=user.is_staff,
    )


@router.post("/auth/login", response=UserOut, auth=None, url_name="login")
def login_view(request, payload: LoginIn):
    """Email and password, in exchange for a session cookie.

    The same 401 for a bad password and an unknown email: distinguishing them
    turns this into an account-enumeration oracle, and a reader who mistyped
    either is helped by neither.
    """
    user = authenticate(request, username=payload.email, password=payload.password)

    if user is None:
        raise HttpError(401, "invalid_credentials")

    login(request, user)
    # Login rotates the CSRF token; setting it here hands the SPA the new one.
    get_token(request)
    return _as_user_out(user)


@router.post("/auth/logout", auth=session_auth, url_name="logout")
def logout_view(request):
    logout(request)
    return {"ok": True}


@router.get("/auth/me", response=UserOut, auth=session_auth, url_name="me")
def me(request):
    """Who is this session? The SPA boots from it (D44).

    401 when anonymous, which is the answer the root machine expects — it starts
    in `waiting` and never assumes anonymous before asking.
    """
    # Makes sure the `csrftoken` cookie exists, so the SPA can send X-CSRFToken
    # on its first unsafe request after a reload (D30).
    get_token(request)
    return _as_user_out(request.auth)
