"""Chapter delivery, and every other outbound message (D27).

    whatsapp.send_chapter(grant)              -> MessageLog
    whatsapp.send_password_reset(reset_token) -> MessageLog

**Delivery failures return; bugs raise.** A function that cannot raise cannot
break a caller's transaction, which is what makes D17's guarantee structural
rather than something five callers must remember.

The real implementation — templates, the Twilio client, the retry policy — lands
in #46. This is the seam's contract and a console fallback, so callers can be
written and tested now.
"""

import logging

from ..models import MessageLog

logger = logging.getLogger(__name__)


def send_chapter(grant) -> MessageLog:
    return _deliver(
        template_key="chapter_delivery",
        user=grant.user,
        to_phone=grant.user.phone,
        grant=grant,
    )


def send_password_reset(reset_token) -> MessageLog:
    return _deliver(
        template_key="set_password",
        user=reset_token.user,
        to_phone=reset_token.user.phone,
    )


def _deliver(template_key, user, to_phone, grant=None) -> MessageLog:
    """The one mechanism. Written `pending` before the attempt (D21).

    Until #46 lands this logs and marks the row sent, so onboarding and the
    reading flow are exercisable end to end without a Twilio account.
    """
    log = MessageLog.objects.create(
        user=user, template_key=template_key, grant=grant, to_phone=to_phone
    )

    # Never log the rendered body — it holds a live token (D22).
    logger.info("whatsapp %s → %s (log %s)", template_key, to_phone, log.pk)

    log.status = MessageLog.SENT
    log.attempts = 1
    log.save(update_fields=["status", "attempts"])
    return log
