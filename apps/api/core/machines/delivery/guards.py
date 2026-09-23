"""Delivery guards. Each reads the attempt's outcome, which the caller supplies.

The service makes the provider call and hands the result in; the machine decides
what that result *means*. That keeps the I/O in the service layer where D36 puts
it, and keeps this table free of ordering subtleties.
"""

def provider_accepted(log, ctx):
    return ctx.payload.outcome.accepted


def is_transient(log, ctx):
    """Worth trying again — a timeout, a 5xx, a rate limit.

    A permanent failure is not retried. A bad number that retries for a year is
    the exact drift D27 warned about.
    """
    return ctx.payload.outcome.transient


def has_attempts_left(log, ctx):
    """Will another attempt follow this one?

    `log.attempts` has not been incremented yet when a guard runs, so attempt N
    sees `N - 1`. Another follows when `N < max`, i.e. `attempts < max - 1`. Off
    by one here means either a silent extra send or a retry that never happens.

    The cap is `settings.WHATSAPP_MAX_ATTEMPTS`, injected — this layer imports no
    Django (D37).
    """
    return log.attempts < ctx.deps.max_attempts() - 1
