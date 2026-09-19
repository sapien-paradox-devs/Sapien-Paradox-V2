"""Delivery guards. Each reads the attempt's outcome, which the caller supplies.

The service makes the provider call and hands the result in; the machine decides
what that result *means*. That keeps the I/O in the service layer where D36 puts
it, and keeps this table free of ordering subtleties.
"""

MAX_ATTEMPTS = 3


def provider_accepted(log, ctx):
    return ctx.payload.outcome.accepted


def is_transient(log, ctx):
    """Worth trying again — a timeout, a 5xx, a rate limit.

    A permanent failure is not retried. A bad number that retries for a year is
    the exact drift D27 warned about.
    """
    return ctx.payload.outcome.transient


def has_attempts_left(log, ctx):
    return log.attempts < MAX_ATTEMPTS
