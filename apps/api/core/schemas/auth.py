"""Typed bodies for the session endpoints (mandate 4). No untyped dicts at the boundary."""

from ninja import Schema


class LoginIn(Schema):
    email: str
    password: str


class UserOut(Schema):
    """What the SPA holds as its reader.

    Exactly the four fields `pages/machine/types.ts` declares. Nothing about
    entitlements or grants: if this grew a domain object the frontend would
    start making access decisions, and `access.can_read` is the only thing
    allowed to (D25).
    """

    id: str
    fullName: str
    email: str
    phone: str


class ResetRequestIn(Schema):
    phone: str


class ResetConfirmIn(Schema):
    token: str
    password: str
