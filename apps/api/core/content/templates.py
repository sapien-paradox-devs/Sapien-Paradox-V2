"""The four WhatsApp message templates (D12).

**Copy lives here, not in send logic.** Editing a message must never mean touching
`services/whatsapp.py`. This mirrors the `labels.ts` mandate on the frontend.

**Every one of these must be pre-approved by Meta before it can be sent.** WhatsApp
forbids free-form business-initiated messages outside a 24-hour window, so the wording
below is not a default that can be tweaked at send time — it is the wording, submitted for
review, and changing it after approval means resubmitting.

All four are submitted together (D12). Two are not used yet: an approved unused template
costs nothing and keeps cadence off Meta's critical path later.

`provider_name` is the identifier registered with Meta via Twilio. It stays empty until
the templates are submitted and approved; the console backend does not need it.

## The variables

Meta templates take positional variables — `{{1}}`, `{{2}} `— so **order is part of the
contract.** `variables` records that order; `body` is the plain-text rendering used by the
console backend and by tests.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Template:
    key: str
    provider_name: str
    variables: tuple[str, ...]
    body: str

    def render(self, values: dict) -> str:
        """Plain text, for the console backend and for tests.

        Raises on a missing variable. A missing variable is a **programmer error**, not a
        delivery failure (D27) — it must surface at development time rather than produce a
        `failed` row that looks like Twilio's fault.
        """
        missing = [name for name in self.variables if name not in values]
        if missing:
            raise KeyError(
                f"template {self.key!r} needs {missing}; got {sorted(values)}"
            )

        ordered = [values[name] for name in self.variables]
        return self.body.format(*ordered)


CHAPTER_DELIVERY = Template(
    key="chapter_delivery",
    provider_name="",
    variables=("first_name", "chapter_title", "link"),
    body=(
        "{0}, {1} is ready when you are.\n\n"
        "{2}\n\n"
        "The link rests after seven days. Ask for a fresh one any time."
    ),
)

FRESH_LINK = Template(
    key="fresh_link",
    provider_name="",
    variables=("first_name", "chapter_title", "link"),
    body=(
        "{0}, here is a fresh link to {1}.\n\n"
        "{2}\n\n"
        "This one rests after seven days too."
    ),
)

# Not sent by anything yet. Submitted early on purpose — cadence will want it, and an
# approved template costs nothing to hold (D12).
UNREAD_REMINDER = Template(
    key="unread_reminder",
    provider_name="",
    variables=("first_name", "chapter_title", "link"),
    body=(
        "{0}, {1} is still waiting whenever you have an hour.\n\n"
        "{2}\n\n"
        "No hurry — that is rather the point."
    ),
)

# Deliberately NOT worded as a reset (D26). A concierge-created reader has never had a
# password, so "reset yours" would be wrong for them — and a second template worded for
# new readers would mean a fifth Meta submission and another review cycle. One neutral
# template serves both.
SET_PASSWORD = Template(
    key="set_password",
    provider_name="",
    variables=("first_name", "link"),
    body=(
        "{0}, set a password for your Sapien Paradox account here:\n\n"
        "{1}\n\n"
        "The link works once, and only for an hour."
    ),
)


TEMPLATES = {
    t.key: t
    for t in (CHAPTER_DELIVERY, FRESH_LINK, UNREAD_REMINDER, SET_PASSWORD)
}


def get(key: str) -> Template:
    """Raises on an unknown key — a bug, not a delivery failure (D27)."""
    try:
        return TEMPLATES[key]
    except KeyError:
        raise KeyError(
            f"unknown template {key!r}; known: {sorted(TEMPLATES)}"
        ) from None


def render(key: str, values: dict) -> str:
    return get(key).render(values)
