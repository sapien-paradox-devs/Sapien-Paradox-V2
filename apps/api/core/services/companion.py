"""The reading companion (D13, D14, D24, D33).

One call site, one function. D24 rejected a generic provider interface on the
grounds that an abstraction over a single call site is a plugin architecture for
a single plugin -- so this selects a provider by name and stops.

**Caps live here, not at the endpoint** (D33). A cap is a property of the
service: every future caller -- a retry, a management command, a second surface
-- gets it for free, and the endpoint stays about HTTP.

Unconfigured, the companion is unavailable and says so. There is no console
fallback that invents a reply: a fake companion is worse than an absent one,
because the reader would believe they had talked to something.
"""

import logging
from dataclasses import dataclass
from datetime import date
from pathlib import Path

from django.conf import settings
from django.db.models import F, Sum

from ..models import ChatUsage

log = logging.getLogger(__name__)

PROMPT_PATH = Path(__file__).resolve().parent.parent / "content" / "companion_prompt.md"
OPENING_PATH = Path(__file__).resolve().parent.parent / "content" / "companion_opening.md"


class CompanionUnavailable(RuntimeError):
    """No API key. Chat is off; nothing else changes."""


@dataclass(frozen=True)
class Refusal:
    """Why a message was not answered. The endpoint maps these to status codes;
    no layer below it knows what a 429 is (D38)."""

    code: str


@dataclass(frozen=True)
class Reply:
    text: str
    input_tokens: int
    output_tokens: int


def system_prompt(chapter) -> str:
    """The whole chapter goes into the system prompt (D13).

    That is what makes input dominate the cost, which is what makes caching the
    lever that matters rather than an optimisation (D24).
    """
    template = PROMPT_PATH.read_text()
    return (
        template
        .replace("{chapter_title}", chapter.title)
        .replace("{chapter_text}", chapter.text_content or "")
    )


def check_caps(grant, message: str) -> Refusal | None:
    """Every reason to refuse, before spending a token. None means proceed."""
    if len(message) > settings.COMPANION_MAX_INPUT_CHARS:
        return Refusal("message_too_long")

    today = date.today()

    used = (
        ChatUsage.objects.filter(grant=grant, date=today)
        .values_list("message_count", flat=True)
        .first()
    ) or 0
    if used >= settings.COMPANION_DAILY_MESSAGES_PER_GRANT:
        return Refusal("grant_daily_cap")

    # The global cap is the one that protects the bill. A per-grant cap alone
    # bounds one reader; it does not bound a hundred of them on the same day.
    total = (
        ChatUsage.objects.filter(date=today).aggregate(n=Sum("message_count"))["n"] or 0
    )
    if total >= settings.COMPANION_DAILY_MESSAGES_GLOBAL:
        return Refusal("global_daily_cap")

    return None


def record_usage(grant, reply: Reply) -> None:
    """One row per grant per day, incremented in the database.

    `F()` rather than read-modify-write: two messages arriving together would
    otherwise each read the same count and write the same value, losing one --
    and a cap that undercounts is not a cap.
    """
    row, _ = ChatUsage.objects.get_or_create(grant=grant, date=date.today())
    ChatUsage.objects.filter(pk=row.pk).update(
        message_count=F("message_count") + 1,
        input_tokens=F("input_tokens") + reply.input_tokens,
        output_tokens=F("output_tokens") + reply.output_tokens,
    )


def opening_cue() -> str:
    """What stands in for the reader's first message when the companion speaks
    first (D13). Copy, so it lives in a content file (mandate 1)."""
    return OPENING_PATH.read_text().strip()


def conversation(turns: list[dict]) -> list[dict]:
    """The panel's turns as provider messages, trimmed for cost (#202, D33).

    Keeps the most recent turns within both caps, each turn cut to the input
    limit. A provider wants the first message to be the reader's, so when the
    kept thread starts with the companion (which spoke first), the opening cue
    goes in front, which is exactly what it was answering.
    """
    kept: list[dict] = []
    budget = settings.COMPANION_HISTORY_CHARS
    for turn in reversed(turns[-settings.COMPANION_HISTORY_TURNS:]):
        text = (turn.get("text") or "")[: settings.COMPANION_MAX_INPUT_CHARS]
        if not text.strip() or len(text) > budget:
            break
        budget -= len(text)
        role = "assistant" if turn.get("role") == "companion" else "user"
        kept.insert(0, {"role": role, "content": text})

    if kept and kept[0]["role"] == "assistant":
        kept.insert(0, {"role": "user", "content": opening_cue()})
    return kept


def ask(grant, message: str, history: list[dict]) -> Reply | Refusal:
    """Ask the companion about this chapter. Never raises for a business reason."""
    refusal = check_caps(grant, message)
    if refusal is not None:
        return refusal

    reply = _complete(
        system=system_prompt(grant.chapter),
        history=history,
        message=message,
    )
    record_usage(grant, reply)
    return reply


def _complete(*, system: str, history: list[dict], message: str) -> Reply:
    """The only vendor-aware function. Selected by env, never hardcoded (D24).

    D46 runs Gemini during the testing phase; Anthropic remains the intended
    production provider. Swapping is this function body, because nothing above
    it knows a vendor type.
    """
    model = settings.COMPANION_MODEL

    if model.startswith("gemini"):
        return _gemini(system=system, history=history, message=message, model=model)

    return _anthropic(system=system, history=history, message=message, model=model)


def _anthropic(*, system: str, history: list[dict], message: str, model: str) -> Reply:
    if not settings.ANTHROPIC_API_KEY:
        raise CompanionUnavailable("ANTHROPIC_API_KEY is not set")

    from anthropic import Anthropic

    client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    response = client.messages.create(
        model=model,
        max_tokens=600,
        # cache_control on the system block: the chapter is the same every turn
        # and dominates the input, and the gaps between questions routinely
        # exceed five minutes, so the 1h TTL is a requirement not a tweak (D24).
        system=[{
            "type": "text",
            "text": system,
            "cache_control": {"type": "ephemeral", "ttl": settings.COMPANION_CACHE_TTL},
        }],
        messages=[*history, {"role": "user", "content": message}],
    )

    return Reply(
        text="".join(block.text for block in response.content if block.type == "text"),
        input_tokens=response.usage.input_tokens,
        output_tokens=response.usage.output_tokens,
    )


def _gemini(*, system: str, history: list[dict], message: str, model: str) -> Reply:
    if not settings.GEMINI_API_KEY:
        raise CompanionUnavailable("GEMINI_API_KEY is not set")

    from google import genai
    from google.genai import types

    client = genai.Client(api_key=settings.GEMINI_API_KEY)

    contents = [
        types.Content(
            role="model" if turn["role"] == "assistant" else "user",
            parts=[types.Part(text=turn["content"])],
        )
        for turn in history
    ]
    contents.append(types.Content(role="user", parts=[types.Part(text=message)]))

    response = client.models.generate_content(
        model=model,
        contents=contents,
        config=types.GenerateContentConfig(system_instruction=system, max_output_tokens=600),
    )

    usage = response.usage_metadata
    return Reply(
        text=response.text or "",
        input_tokens=getattr(usage, "prompt_token_count", 0) or 0,
        output_tokens=getattr(usage, "candidates_token_count", 0) or 0,
    )
