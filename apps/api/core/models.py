"""Domain models.

Single file for now — eight tables don't justify a package, and splitting later costs
nothing (same `app_label`, no migration impact).

**Only `User` lives here so far.** The other seven tables (D18) land in their own issue.
`User` is here from the first commit because `AUTH_USER_MODEL` must exist in migration
0001 — Django makes changing it afterwards a painful manual migration.

Specs and rationale: `../../decisions/04-data.md` (D4, D18, D19, D21).
"""

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models


class UserManager(BaseUserManager):
    """Email is the login field; phone is required because it is the delivery *and*
    account-recovery channel (D16, D19)."""

    use_in_migrations = True

    def create_user(self, email, phone, full_name, password=None, **extra):
        if not email:
            raise ValueError("A user needs an email address.")
        if not phone:
            raise ValueError("A user needs a phone number — it is how chapters are delivered.")

        user = self.model(
            email=self.normalize_email(email),
            phone=phone,
            full_name=full_name,
            **extra,
        )
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, phone, full_name, password=None, **extra):
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)

        if extra.get("is_staff") is not True:
            raise ValueError("A superuser must have is_staff=True.")
        if extra.get("is_superuser") is not True:
            raise ValueError("A superuser must have is_superuser=True.")

        return self.create_user(email, phone, full_name, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    """D19.

    No `role` field: V1 carried `role` *and* Django's `is_staff`/`is_superuser` — two
    systems answering one question, free to drift. Django admin gates on `is_staff`, and
    D10 makes admin the entire onboarding surface, so nothing consumes a domain role.

    `phone` is unique, which V1's was not. Survivable when a phone is only a delivery
    address; not once it is the account-recovery channel — two accounts sharing a number
    makes "send me a reset link" ambiguous.
    """

    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=200)
    phone = models.CharField(
        max_length=20,
        unique=True,
        help_text="E.164, e.g. +919876543210. Delivery and account recovery.",
    )

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["phone", "full_name"]

    class Meta:
        ordering = ["-date_joined"]

    def __str__(self):
        return self.email
