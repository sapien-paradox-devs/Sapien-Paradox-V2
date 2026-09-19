"""Django admin.

**This is a product surface, not a debug tool.** Concierge onboarding is the entire way
readers come into existence until payments land (D10), so the person using these screens is
running the business.

**No business logic here.** Admin actions call service functions, which is what makes the
Stripe webhook a drop-in later rather than a second implementation. Actions arrive with
their own issues — this file registers models and nothing more.
"""

from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from core.models import (
    Book,
    Chapter,
    ChatUsage,
    MessageLog,
    Order,
    PasswordResetToken,
    TemporalGrant,
    User,
)


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    list_display = ("email", "full_name", "phone", "is_staff", "date_joined")
    list_filter = ("is_staff", "is_active")
    search_fields = ("email", "full_name", "phone")
    ordering = ("-date_joined",)

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Reader", {"fields": ("full_name", "phone")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Dates", {"fields": ("last_login", "date_joined")}),
    )
    readonly_fields = ("date_joined", "last_login")

    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                # Phone is not optional: it is how chapters are delivered and how an
                # account is recovered (D16).
                "fields": ("email", "full_name", "phone", "password1", "password2"),
            },
        ),
    )


class ChapterInline(admin.TabularInline):
    """Chapters are edited in the context of their book — that is how a book gets built."""

    model = Chapter
    extra = 0
    fields = ("order_index", "title", "file", "page_count")
    readonly_fields = ("page_count",)
    ordering = ("order_index",)


@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
    list_display = ("title", "slug", "chapter_count", "is_published", "created_at")
    list_filter = ("is_published",)
    search_fields = ("title", "slug")
    prepopulated_fields = {"slug": ("title",)}
    inlines = [ChapterInline]

    @admin.display(description="chapters")
    def chapter_count(self, obj):
        return obj.chapters.count()


@admin.register(Chapter)
class ChapterAdmin(admin.ModelAdmin):
    list_display = ("book", "order_index", "title", "page_count", "has_text")
    list_filter = ("book",)
    search_fields = ("title", "book__title")
    ordering = ("book", "order_index")
    readonly_fields = ("page_count", "text_content")

    @admin.display(boolean=True, description="text extracted")
    def has_text(self, obj):
        return bool(obj.text_content)


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("user", "book", "pace", "created_at")
    list_filter = ("pace", "book")
    search_fields = ("user__email", "user__phone", "book__title")
    autocomplete_fields = ("user", "book")


@admin.register(TemporalGrant)
class TemporalGrantAdmin(admin.ModelAdmin):
    actions = ["resend_chapter"]

    @admin.action(description="Send this chapter's link again, over WhatsApp")
    def resend_chapter(self, request, queryset):
        """The concierge's main repair. A mistyped number, a failed send, a
        reader who lost the message -- all end here.

        Goes through the seams (D27): mint_or_reuse, then send_chapter. It does
        NOT reuse the selected grant's token blindly, because a selected grant
        may be expired and reviving it would undo the point of expiry (D21).
        """
        sent = failed = refused = 0

        for grant in queryset.select_related("user", "chapter__book"):
            if not access.can_read(grant.user, grant.chapter):
                refused += 1
                continue

            fresh = grants.mint_or_reuse(grant.user, grant.chapter)
            log = whatsapp.send_chapter(fresh)

            if log.status == "sent":
                sent += 1
            else:
                failed += 1
                # Named, because the person who can fix a bad number is the
                # person looking at this screen right now (D26).
                self.message_user(
                    request,
                    f"{grant.user.email}: {log.error or log.status}",
                    level=messages.ERROR,
                )

        self.message_user(
            request,
            f"sent {sent}· failed {failed}· refused {refused}",
            level=messages.SUCCESS if failed == 0 and refused == 0 else messages.WARNING,
        )

    """The token column is deliberately absent from every display.

    A token is a credential, and admin pages get screenshotted and shared. D22 says never
    put one where it might be logged; the same reasoning applies to a list view.
    """

    list_display = ("id", "user", "chapter", "created_at", "expires_at", "expired", "opened_at")
    list_filter = ("chapter__book",)
    search_fields = ("user__email", "user__phone")
    autocomplete_fields = ("user", "chapter")
    readonly_fields = ("token", "created_at")

    @admin.display(boolean=True, description="expired")
    def expired(self, obj):
        return obj.is_expired


@admin.register(MessageLog)
class MessageLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "template_key", "user", "to_phone", "status", "attempts")
    list_filter = ("status", "template_key")
    search_fields = ("user__email", "to_phone", "provider_message_id")
    readonly_fields = ("created_at", "sent_at", "provider_message_id", "error", "attempts")


@admin.register(ChatUsage)
class ChatUsageAdmin(admin.ModelAdmin):
    list_display = ("date", "grant", "message_count", "input_tokens", "output_tokens")
    list_filter = ("date",)
    readonly_fields = ("grant", "date", "message_count", "input_tokens", "output_tokens")


@admin.register(PasswordResetToken)
class PasswordResetTokenAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "created_at", "expires_at", "used_at", "usable")
    search_fields = ("user__email", "user__phone")
    readonly_fields = ("token", "created_at", "used_at")

    @admin.display(boolean=True, description="usable")
    def usable(self, obj):
        return obj.is_usable
