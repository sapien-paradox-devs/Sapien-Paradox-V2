"""Chapter delivery, and every other outbound message (D27).

    whatsapp.send_chapter(grant)              -> MessageLog
    whatsapp.send_password_reset(reset_token) -> MessageLog

**One mechanism, named wrappers.** `_deliver` owns the retry policy, the `MessageLog`
lifecycle, and the backend switch. The wrappers know how to build one template's variables
and nothing else. A separate implementation per message type would mean two retry policies
that drift — one gets the never-retry-4xx rule and the other doesn't, and you find out when
a bad number retries for a year.

**Delivery failures return; bugs raise** (D27). A function that cannot raise cannot break a
caller's transaction, which is what makes D17's guarantee structural rather than something
five callers must each remember. An unknown template key or a missing variable still
raises — those are programmer errors, and a `failed` row would wrongly blame Twilio.

**Never log the rendered body and never store it** (D21, D22). It contains a live token,
which is a credential. `template_key` plus `grant` reproduces it exactly, and logs are less
protected than the database.
"""

import logging
import time
from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from ..constants import ROUTES
from ..content import templates
from ..models import MessageLog

logger = logging.getLogger(__name__)


class TransientDeliveryError(Exception):
    """Worth retrying: a network blip, a timeout, a 429, a 5xx."""


class PermanentDeliveryError(Exception):
    """Never retry: an invalid number, an unapproved template, an opted-out recipient.

    Retrying a permanent failure is pure delay — it cannot succeed, and it burns the
    request's remaining time budget before reporting the same thing.
    """


# ─────────────────────────────────────────────────────────────────────────────
# Public seam
# ─────────────────────────────────────────────────────────────────────────────

def send_chapter(grant) -> MessageLog:
    """Deliver one chapter's link. The caller mints the grant (D27).

    Home reuses a live grant; sanctuary mints a fresh one. That decision belongs to the
    caller, not to a flag on this function.
    """
    return _deliver(
        template_key="chapter_delivery",
        user=grant.user,
        to_phone=grant.user.phone,
        values={
            "first_name": _first_name(grant.user),
            "chapter_title": grant.chapter.title,
            "link": reader_link(grant.token),
        },
        grant=grant,
    )


def send_fresh_link(grant) -> MessageLog:
    """The one-tap recovery from an expired link (D9).

    Deliberately a different template from `send_chapter` even though the variables match:
    a reader who asked for a fresh link should not be told their chapter "is ready when you
    are" as though nothing happened.
    """
    return _deliver(
        template_key="fresh_link",
        user=grant.user,
        to_phone=grant.user.phone,
        values={
            "first_name": _first_name(grant.user),
            "chapter_title": grant.chapter.title,
            "link": reader_link(grant.token),
        },
        grant=grant,
    )


def send_password_reset(reset_token) -> MessageLog:
    """Worded as "set a password", because a concierge-created reader never had one (D26)."""
    return _deliver(
        template_key="set_password",
        user=reset_token.user,
        to_phone=reset_token.user.phone,
        values={
            "first_name": _first_name(reset_token.user),
            "link": reset_link(reset_token.token),
        },
    )


# ─────────────────────────────────────────────────────────────────────────────
# Links — built from the shared route patterns (D20)
#
# The backend builds these and the frontend routes them. Drift means every link in
# every message 404s, which is why the patterns live in one file read by both.
# ─────────────────────────────────────────────────────────────────────────────

def recently_sent(user, template_key: str, minutes: int) -> bool:
    """Has this reader already been sent one of these, lately? (D31)

    Counted from MessageLog rows rather than a counter: the rows are written
    anyway, and a counter is a second truth that drifts from them. It lives here
    rather than in one router because two callers need it — the signed-in resend
    in `api/read.py`, and the post-checkout one, which has no session at all.
    """
    since = timezone.now() - timedelta(minutes=minutes)
    return MessageLog.objects.filter(
        user=user, template_key=template_key, created_at__gte=since
    ).exists()


def reader_link(token: str) -> str:
    return settings.APP_BASE_URL + ROUTES["reader"].replace(":token", token)


def reset_link(token: str) -> str:
    return settings.APP_BASE_URL + ROUTES["resetConfirm"].replace(":token", token)


def _first_name(user) -> str:
    return (user.full_name or "").split(" ")[0] or user.full_name or "there"


# ─────────────────────────────────────────────────────────────────────────────
# The one mechanism
# ─────────────────────────────────────────────────────────────────────────────

_BACKOFF_SECONDS = (0.5, 1.5)


def _deliver(template_key, user, to_phone, values, grant=None) -> MessageLog:
    """Render, send with bounded retry, and record the attempt.

    The row is written `pending` **before** the first attempt (D21), so a crash mid-send
    leaves evidence rather than nothing. There is no queue (D17): retry happens inside the
    request, worst case about two seconds.
    """
    template = templates.get(template_key)      # raises on an unknown key — a bug
    body = template.render(values)              # raises on a missing variable — a bug

    log = MessageLog.objects.create(
        user=user, template_key=template_key, grant=grant, to_phone=to_phone
    )

    backend = _backend()
    max_attempts = max(1, settings.WHATSAPP_MAX_ATTEMPTS)
    last_error = ""

    for attempt in range(1, max_attempts + 1):
        log.attempts = attempt
        try:
            provider_id = backend(to_phone, body)
        except PermanentDeliveryError as exc:
            last_error = str(exc)
            logger.warning(
                "whatsapp permanent failure, not retrying",
                extra={"template": template_key, "message_log": log.pk, "attempt": attempt},
            )
            break
        except TransientDeliveryError as exc:
            last_error = str(exc)
            logger.warning(
                "whatsapp transient failure",
                extra={"template": template_key, "message_log": log.pk, "attempt": attempt},
            )
            if attempt < max_attempts:
                time.sleep(_BACKOFF_SECONDS[min(attempt - 1, len(_BACKOFF_SECONDS) - 1)])
                continue
            break
        else:
            log.status = MessageLog.SENT
            log.provider_message_id = provider_id
            log.sent_at = timezone.now()
            log.error = None
            log.save(update_fields=["status", "attempts", "provider_message_id", "sent_at", "error"])
            # The body is never logged — it holds a live token (D22).
            logger.info(
                "whatsapp sent",
                extra={"template": template_key, "message_log": log.pk, "attempts": attempt},
            )
            return log

    log.status = MessageLog.FAILED
    log.error = last_error
    log.save(update_fields=["status", "attempts", "error"])
    return log


# ─────────────────────────────────────────────────────────────────────────────
# Backends
# ─────────────────────────────────────────────────────────────────────────────

def _backend():
    if settings.WHATSAPP_BACKEND == "twilio":
        return _twilio_send
    return _console_send


def _console_send(to_phone, body) -> str:
    """The fallback when Twilio is unconfigured.

    Local work and CI never touch the network or spend money, which is what lets the whole
    product be built and deployed before the templates clear Meta review.

    This prints the body deliberately — it is a developer's own terminal, not a log
    shipped anywhere. The rule about tokens is about persisted logs (D22).
    """
    print(f"\n─── whatsapp → {to_phone} ───\n{body}\n────────────────────────────\n")
    return "console"


def _twilio_send(to_phone, body) -> str:
    """Real delivery.

    Twilio's HTTP status decides retryability, not the message text: 429 and 5xx are
    transient, every other 4xx is permanent (D17).
    """
    from twilio.base.exceptions import TwilioException, TwilioRestException
    from twilio.rest import Client

    client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)

    try:
        message = client.messages.create(
            from_=settings.TWILIO_WHATSAPP_FROM,
            to=_whatsapp_address(to_phone),
            body=body,
        )
    except TwilioRestException as exc:
        status = exc.status or 0
        detail = f"twilio {status} code={exc.code}: {exc.msg}"
        if status == 429 or status >= 500:
            raise TransientDeliveryError(detail) from exc
        raise PermanentDeliveryError(detail) from exc
    except TwilioException as exc:
        # Connection-level: no HTTP status at all, so assume transient.
        raise TransientDeliveryError(f"twilio transport: {exc}") from exc

    return message.sid


def _whatsapp_address(phone: str) -> str:
    return phone if phone.startswith("whatsapp:") else f"whatsapp:{phone}"
