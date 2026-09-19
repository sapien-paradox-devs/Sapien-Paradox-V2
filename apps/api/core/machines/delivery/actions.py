"""Delivery actions. Each records what the attempt produced."""

from ..binding import touched


def record_sent(log, ctx):
    log.attempts += 1
    log.provider_message_id = ctx.payload.outcome.provider_message_id
    touched(log, "attempts", "provider_message_id")
    ctx.produce(log)


def record_retry(log, ctx):
    """Count the attempt and stay pending, so the caller tries again."""
    log.attempts += 1
    log.error = ctx.payload.outcome.error
    touched(log, "attempts", "error")
    ctx.produce(log)


def record_failure(log, ctx):
    log.attempts += 1
    log.error = ctx.payload.outcome.error
    touched(log, "attempts", "error")
    ctx.produce(log)
