"""One spelling of a phone number, everywhere (D19).

`User.phone` is unique and is both the delivery address and the account-recovery
channel. Nothing normalised it, so every lookup was an exact string match against
whatever a form happened to submit:

  * `reset_request` answers identically for a known and an unknown number so it
    cannot be used to discover who has an account — which means a formatting
    mismatch looks exactly like success and sends nothing
  * `_resolve_identity` would read `+918712740175` and `8712740175` as two
    different people, and the unique constraint is on the string, so one human
    could hold two accounts
  * Twilio needs E.164; a number stored without its `+` is rejected

Normalising on the way in and on every lookup is what makes the unique constraint
mean what D19 says it means.
"""

import re

from django.conf import settings

_NON_DIGITS = re.compile(r"[^\d+]")


def normalize(raw: str | None) -> str:
    """E.164, as far as we can tell without a full parser.

    Deliberately not phonenumbers: it is a large dependency for one field, and
    the product is India-first (INR, Razorpay, the Singapore region). A bare
    national number gets DEFAULT_COUNTRY_CODE; anything already carrying a `+`
    is left alone but cleaned.
    """
    if not raw:
        return ""

    cleaned = _NON_DIGITS.sub("", raw.strip()).replace("whatsapp:", "")

    # A `+` anywhere but the front is a typo, not a country code.
    if "+" in cleaned:
        cleaned = "+" + cleaned.replace("+", "")

    if not cleaned:
        return ""

    if cleaned.startswith("+"):
        return cleaned

    code = settings.DEFAULT_COUNTRY_CODE.lstrip("+")

    # Already carries the country code, just without the plus.
    if cleaned.startswith(code) and len(cleaned) > len(code):
        return "+" + cleaned

    # `0` prefixes a national number in India and several other plans.
    return "+" + code + cleaned.lstrip("0")


def matches(raw: str | None) -> str:
    """The value to look a reader up by. Same rule as storing, by construction."""
    return normalize(raw)
