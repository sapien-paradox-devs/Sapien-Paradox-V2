"""Domain models — the eight tables (D18).

Single file for now. Eight tables don't justify a package, and moving classes into one
later costs nothing: same `app_label`, no migration impact.

Field-level specs and the reasoning behind every departure from V1 live in
`../../decisions/04-data.md` (D4, D18, D19, D21). The comments here record the traps, not
the rationale — go to the decision for the why.

    User ──< Order >── Book ──< Chapter ──< TemporalGrant >── User
                                     │
                                (PDF file, text_content)
    MessageLog >── User, TemporalGrant
    ChatUsage  >── TemporalGrant
    PasswordResetToken >── User
"""

import uuid
from datetime import timedelta

import shortuuid
from django.conf import settings
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone

from core.constants import PACE_CHOICES


# ─────────────────────────────────────────────────────────────────────────────
# Callables used as field defaults.
#
# These MUST be module-level functions. V1 lost an entire ticket to using
# `shortuuid.uuid` directly as a field default — it is a bound method on a module
# singleton, so every insert broke at runtime and Django's autodetector then looped
# proposing the same migration forever. A module-level wrapper gives the migration a
# stable import path.
# ─────────────────────────────────────────────────────────────────────────────

def generate_token():
    """Grant and reset tokens. Short enough to sit in a WhatsApp message."""
    return shortuuid.uuid()


def default_grant_expiry():
    return timezone.now() + timedelta(days=settings.GRANT_TTL_DAYS)


def default_reset_expiry():
    return timezone.now() + timedelta(minutes=settings.RESET_TOKEN_TTL_MINUTES)


def chapter_upload_path(instance, filename):
    """`chapters/<book-slug>/<index>-<uuid>.pdf`.

    The UUID matters: without it, re-uploading a corrected chapter either overwrites
    silently — leaving readers with the file cached still seeing the old one — or picks up
    a mangled storage suffix.
    """
    return f"chapters/{instance.book.slug}/{instance.order_index}-{uuid.uuid4()}.pdf"


# ─────────────────────────────────────────────────────────────────────────────
# People
# ─────────────────────────────────────────────────────────────────────────────

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


# ─────────────────────────────────────────────────────────────────────────────
# Content
# ─────────────────────────────────────────────────────────────────────────────

class Book(models.Model):
    """D19.

    Nothing here that no screen renders yet — no author, description, or cover. Fields
    nobody displays are how V1 acquired its unspecced view quota.
    """

    title = models.CharField(max_length=300)
    slug = models.SlugField(unique=True)
    price_cents = models.PositiveIntegerField(
        default=0,
        help_text="Payments are sequenced later (D1), but the price belongs to the book.",
    )
    is_published = models.BooleanField(
        default=False,
        help_text=(
            "Concierge onboarding works against a live database. Without this, a half-built "
            "book with three of eight chapters is immediately assignable."
        ),
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["title"]

    def __str__(self):
        return self.title


class Chapter(models.Model):
    """D19.

    `text_content` and `page_count` are filled by `services/extraction.py`, called
    explicitly from the admin save and from `seed_dev` — **never a `post_save` signal**. A
    hidden 40-page PDF parse behind an innocuous `.save()` is a surprise found only in
    production.

    `page_count` is free: the PDF is already being parsed for `text_content`, and the
    reader needs it for page controls without re-parsing on every open.

    `page_layout` is filled alongside, by `services/pages.py`: the PDF itself never reaches
    a browser, only watermarked images of its pages (D73).
    """

    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name="chapters")
    order_index = models.PositiveIntegerField(help_text="1-based.")
    title = models.CharField(max_length=300)
    file = models.FileField(upload_to=chapter_upload_path)

    text_content = models.TextField(
        null=True,
        blank=True,
        help_text="Extracted at upload. The companion's entire context (D13).",
    )
    page_count = models.PositiveIntegerField(null=True, blank=True)
    page_layout = models.JSONField(
        null=True,
        blank=True,
        help_text=(
            "Filled at upload by services/pages.py (D73): each page's size and rendered "
            "image, and the PDF's sections. Null until rendered; the reader cannot open "
            "a chapter without it."
        ),
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order_index"]
        constraints = [
            models.UniqueConstraint(
                fields=["book", "order_index"], name="unique_chapter_index_per_book"
            )
        ]

    def __str__(self):
        return f"{self.book.title} — {self.order_index}. {self.title}"


# ─────────────────────────────────────────────────────────────────────────────
# Entitlement
# ─────────────────────────────────────────────────────────────────────────────

class Order(models.Model):
    """D19.

    An entitlement today, a purchase record again once payments return — the name is kept
    rather than renamed twice.

    No Stripe columns. V1's `stripe_session_id` was unique *and* required, which makes a
    concierge-created order impossible to save. Payments add their real shape when they
    land; the committed seam is `onboarding.create_reader(...)`, not speculative columns.

    `created_at` is the cadence anchor: chapter N unlocks at `created_at + (N-1) × delay`.
    """

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="orders")
    book = models.ForeignKey(Book, on_delete=models.PROTECT, related_name="orders")
    pace = models.CharField(max_length=20, choices=PACE_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    # D47. The gateway's reference for the payment that created this order, and
    # the thing that makes the webhook idempotent -- Razorpay retries, so the
    # same event arrives twice and the second must find this row and stop.
    #
    # Blank, NOT unique-and-required. D19 dropped V1's `stripe_session_id`
    # precisely because it was both, which made a concierge-created order
    # impossible to save. An admin still creates readers by hand and those
    # orders have no payment at all.
    payment_reference = models.CharField(
        max_length=100, blank=True, default="", db_index=True,
        help_text="Razorpay payment_link id. Empty for concierge-created orders.",
    )

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            # Makes access.can_read a simple existence check, and stops an admin
            # double-creating an order and silently doubling a reader's grants.
            models.UniqueConstraint(fields=["user", "book"], name="one_order_per_user_per_book")
        ]

    def __str__(self):
        return f"{self.user.email} — {self.book.title} ({self.pace})"


class TemporalGrant(models.Model):
    """D21. Time-bounded access to one chapter, for one reader.

    **`(user, chapter)` is indexed but deliberately NOT unique.** Re-issue mints a new row
    with a new token; `mint_or_reuse` selects the newest unexpired one.

    If it were unique, re-issue would extend `expires_at` in place and **the old token
    would stay valid** — silently reviving access for anyone holding a forwarded expired
    link, and undoing the entire point of 7-day expiry for exactly the case it was designed
    for. A few extra rows per reader per chapter is nothing by comparison.

    This looks obviously wrong and is deliberate.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="grants"
    )
    chapter = models.ForeignKey(Chapter, on_delete=models.CASCADE, related_name="grants")

    token = models.CharField(max_length=32, unique=True, default=generate_token)
    expires_at = models.DateTimeField(default=default_grant_expiry)

    unlock_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="The cadence seam. Always null until cadence lands (D1).",
    )
    opened_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="The FIRST open, not the last. An engagement signal, not analytics.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    # The reading machine's state (D36). Grants begin live because `unlock_at`
    # is null until cadence lands; `scheduled` is reachable only once it does.
    #
    # There is no `expired` state on purpose: expiry is derived from
    # `expires_at`, and storing it too would need a sweeper to keep the two
    # agreeing. See core/machines/reading/machine.py.
    SCHEDULED = "scheduled"
    LIVE = "live"
    OPENED = "opened"
    STATE_CHOICES = [(SCHEDULED, SCHEDULED), (LIVE, LIVE), (OPENED, OPENED)]

    state = models.CharField(max_length=20, choices=STATE_CHOICES, default=LIVE)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "chapter"])]

    def __str__(self):
        # Never the token — D22 forbids putting one anywhere it might be logged.
        return f"grant {self.pk} · {self.user.email} · chapter {self.chapter_id}"

    @property
    def is_expired(self):
        return timezone.now() >= self.expires_at


class ReadingProgress(models.Model):
    """D70. How far a reader has got through a chapter, and whether they finished it.

    **Keyed on (user, chapter), not on the grant.** A re-issued link (D9) is a new grant,
    and the reader's place must survive it. A reader with only a token writes through
    `grant.user`, so progress needs no session.

    `furthest` only ever grows — rereading a paragraph is not losing ground — and stays
    below 1 until the reader marks the chapter complete. Completion is declared, never
    inferred from reaching the last page.

    **Nothing in access, delivery or cadence may read this** (D70). Chapters unlock on a
    schedule, never on completion. A ninth table: amends D18, born in `core/` per D72,
    bound for `apps/reading`.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reading_progress"
    )
    chapter = models.ForeignKey(Chapter, on_delete=models.CASCADE, related_name="progress")

    furthest = models.FloatField(default=0.0, help_text="0–1. Only ever increases.")
    completed_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "chapter"], name="unique_progress_per_reader_chapter")
        ]

    def __str__(self):
        state = "complete" if self.completed_at else f"{round(self.furthest * 100)}%"
        return f"{self.user} — {self.chapter}: {state}"


# ─────────────────────────────────────────────────────────────────────────────
# Records
# ─────────────────────────────────────────────────────────────────────────────

class MessageLog(models.Model):
    """D21. What we tried to send, and what happened.

    **Never store the rendered body.** It contains a live token — a credential — and
    duplicating it gives two places to leak from instead of one. `template_key` plus
    `grant` reproduces it exactly.

    Written `pending` *before* the attempt and updated in place, so a crash mid-send leaves
    evidence rather than nothing (there is no queue — D17).
    """

    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"
    STATUS_CHOICES = [(PENDING, PENDING), (SENT, SENT), (FAILED, FAILED)]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="messages"
    )
    template_key = models.CharField(max_length=64)
    grant = models.ForeignKey(
        TemporalGrant,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="messages",
        help_text="Null for account messages such as password reset — they have no chapter.",
    )

    to_phone = models.CharField(
        max_length=20,
        help_text="A snapshot. A reader changes their number; logs record what happened.",
    )
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=PENDING)
    attempts = models.PositiveSmallIntegerField(default=0)

    provider_message_id = models.CharField(max_length=100, null=True, blank=True)
    error = models.TextField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="'sent' means the provider accepted it, NOT that it arrived.",
    )

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "created_at"])]

    def __str__(self):
        return f"{self.template_key} → {self.user.email} ({self.status})"


class ChatUsage(models.Model):
    """D21. What the companion cost, and for whom.

    A real table rather than a cache counter: there is no Redis (D17), it survives
    restarts, it is visible in admin, and a counter alone cannot tell you *which* grant
    burned the budget after the fact.

    **Never stores message content** (D18). Retaining private reading-room conversations
    would contradict a product whose pitch is quiet, unmonitored reading, and would create
    a data-protection obligation that does not otherwise exist.

    Keyed by grant rather than user because `/api/chat` is token-authenticated and the
    caller may have no session. Token counts are plain integers — vendor-neutral, so cost
    comparison survives a provider swap (D24).
    """

    grant = models.ForeignKey(TemporalGrant, on_delete=models.CASCADE, related_name="chat_usage")
    date = models.DateField()

    message_count = models.PositiveIntegerField(default=0)
    input_tokens = models.PositiveIntegerField(default=0)
    output_tokens = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-date"]
        constraints = [
            models.UniqueConstraint(fields=["grant", "date"], name="one_usage_row_per_grant_per_day")
        ]
        indexes = [models.Index(fields=["date"])]

    def __str__(self):
        return f"grant {self.grant_id} · {self.date} · {self.message_count} messages"


class PasswordResetToken(models.Model):
    """D21. Single-use, ~1 hour.

    Separate from `TemporalGrant` rather than a generic token table with a `purpose`
    column: a grant is multi-open and lives 7 days, a reset token is single-use and lives
    an hour. One table would accumulate `if purpose ==` branches and serve neither well.

    **Single use matters here more than usual.** Reset links sit in WhatsApp history
    forever, so a reusable one is a permanent account key.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reset_tokens"
    )
    token = models.CharField(max_length=32, unique=True, default=generate_token)

    expires_at = models.DateTimeField(default=default_reset_expiry)
    used_at = models.DateTimeField(
        null=True, blank=True, help_text="Set when the password actually changes."
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        # Never the token.
        return f"reset {self.pk} · {self.user.email}"

    @property
    def is_usable(self):
        return self.used_at is None and timezone.now() < self.expires_at
