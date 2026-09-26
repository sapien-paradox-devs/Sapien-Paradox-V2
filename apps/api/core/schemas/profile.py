"""Typed bodies for the profile endpoints (mandate 4)."""

from ninja import Schema


class BookProgressOut(Schema):
    title: str
    chaptersUnlocked: int
    chaptersTotal: int
    progress: float


class ProfileOut(Schema):
    fullName: str
    email: str
    phone: str | None
    hasPassword: bool
    avatarSeed: str | None
    books: list[BookProgressOut]


class ProfileUpdateIn(Schema):
    fullName: str | None = None
    email: str | None = None
    avatarSeed: str | None = None


class PasswordIn(Schema):
    currentPassword: str | None = None
    newPassword: str
