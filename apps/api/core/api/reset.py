"""Password reset, over WhatsApp (D16, D21).

There is no email provider, deliberately. WhatsApp is the only outbound channel,
which also means a reset link sits in a chat history forever -- so the token is
**single-use**, or it is a permanent account key.

This closes the hole a paying reader falls into: D26 gives them an unusable
password and a set-a-password link, and until now that link had no backend.
"""

import logging
from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from ninja import Router
from ninja.errors import HttpError

from ..models import PasswordResetToken, User
from ..schemas.auth import ResetConfirmIn, ResetRequestIn
from ..services import whatsapp

router = Router()
log = logging.getLogger(__name__)


@router.post("/auth/reset/request", auth=None, url_name="reset_request")
def reset_request(request, payload: ResetRequestIn):
    """Send a fresh set-a-password link to the phone on the account.

    **Answers identically whether or not the phone is known.** Anything else
    makes this an oracle for who has an account -- and the people most likely to
    probe it are not the people it is for.

    The rate limit is counted from `PasswordResetToken` rows (D31), and applies
    per user rather than per request, so a stranger cannot spend someone else's
    quota by guessing their number repeatedly.
    """
    phone = payload.phone.strip()
    user = User.objects.filter(phone=phone).first()

    if user is not None:
        since = timezone.now() - timedelta(minutes=settings.RESET_REQUEST_COOLDOWN_MINUTES)
        recent = PasswordResetToken.objects.filter(user=user, created_at__gte=since).exists()

        if recent:
            log.info("reset request throttled for user %s", user.pk)
        else:
            token = PasswordResetToken.objects.create(user=user)
            whatsapp.send_password_reset(token)

    # One answer, always. Never says whether anything was sent.
    return {"status": "ok"}


@router.post("/auth/reset/confirm", auth=None, url_name="reset_confirm")
def reset_confirm(request, payload: ResetConfirmIn):
    """Set the password, once.

    `used_at` is stamped in the same step as the password change. A reusable
    link is a permanent account key, because the message it arrived in is still
    sitting in WhatsApp.
    """
    token = PasswordResetToken.objects.select_related("user").filter(token=payload.token).first()

    # Unknown, expired and already-used all answer the same way: none of them
    # are recoverable from this screen, and distinguishing them tells a stranger
    # which tokens were ever real.
    if token is None or token.used_at is not None or timezone.now() >= token.expires_at:
        raise HttpError(410, "link_expired")

    if len(payload.password) < 8:
        raise HttpError(422, "password_too_short")

    user = token.user
    user.set_password(payload.password)
    user.save(update_fields=["password"])

    token.used_at = timezone.now()
    token.save(update_fields=["used_at"])

    log.info("password set for user %s", user.pk)
    return {"status": "ok"}
