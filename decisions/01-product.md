# Product decisions

D1 · D8 · D9 · D10 · D13 · D14

---

## D1 — V2 is the same product as V1, rebuilt for control

**Locked** 2026-08-08

The full thesis stands: pay once for a book, chapters unlock on a cadence, each delivered by
WhatsApp as a self-authenticating link, read in a token-gated chamber. **Payments and cadence are
sequenced later, not dropped.** The five current features are the first slices of the real
product, not a reduced product.

**Consequence:** we keep the seams. `TemporalGrant` stays, access checks route through one service
function, WhatsApp sends stay grant-based. Cadence later means "write `cadence.py`, set
`unlock_at`" with no rewiring.

**Rejected — a simpler session-only design** (drop `TemporalGrant`, session-authenticate
everything, WhatsApp sends a login link). WhatsApp links must self-authenticate: a link that
dead-ends on a login screen is a bad demo and a worse product. That is the entire reason
`TemporalGrant` exists.

**Reinforced later:** WhatsApp links open in WhatsApp's in-app browser, which has **its own cookie
jar**. A reader logged in via Safari is not logged in there. Session-based links would be broken
for everyone, always — not merely inconvenient.

---

## D8 — Grants expire after 7 days

**Locked** 2026-08-08

**Inherited from V1**
- **V1 did:** `expires_at` existed but nothing computed a meaningful value; links were eternal by
  accident.
- **V2 does:** 7 days.
- **Why:** matches the product's temporal vocabulary and bounds forwarded-link access. Aligns with
  cadence later — a chapter's link stays live roughly until the next arrives.
- **Revisit if:** readers hit sanctuary often enough to feel punished. Loosening is one field and
  one comparison.
- **Follow V1?** ☐ yes ☑ no

**Rejected:** never expire (a forwarded link becomes permanent free access, unrevokable) · 90 days
(recommended at the time; overruled for tighter control).

**Consequence: sanctuary is a frequent state, not an edge case.** It must be good. This is what
forced D9.

---

## D9 — Expired links recover in one tap

**Locked** 2026-08-08

Sanctuary shows "this link has rested" and a single **"Send me a fresh link"** button. No input,
no login.

**The detail that makes it work:** an expired grant still identifies its owner. We already know
who tapped and what they wanted, so we ask nothing — we mint a new grant and send it to the phone
on the account.

**Safety:** the new link goes to the *owner's* phone, never the tapper's, so a forwarded expired
link leaks no access. Rate limited to one re-issue per grant per hour to prevent nuisance
messaging.

**Rejected:** asking for identity (we already know it — typing on a phone to tell us something we
have) · requiring login (a password prompt on a device that has never had one, on the product's
most common failure path).

**Accepted consequence:** WhatsApp becomes load-bearing for **recovery**, not just delivery. If
Twilio is down, expired-link recovery is down; logging in on Home remains the fallback. D16 later
leaned on this same channel for password reset.

---

## D10 — Readers are created by concierge onboarding

**Locked** 2026-08-08

Django admin creates the reader and their `Order`; the system mints grants and sends chapter 1.
`seed_dev` does the same locally for a fixed test reader. **No public signup exists** until
payments land.

**The seam:** both paths call one service function,
`onboarding.create_reader(name, email, phone, book, pace)`. There is exactly one code path that
brings a reader into existence, so Stripe later is "call this existing function from a webhook"
rather than a new flow.

**Rejected:** a public no-payment signup page — builds a screen that gets reworked once payment
gates it, and gives the product away meanwhile.

**Open, contradicting this:** whether a signup page is in scope after all (`STATUS.md` #10). It
would cost one leaf in the frontend page region, but it reverses this decision and requires
deciding what a non-paying reader gets.

---

## D13 — The chatbot is a chapter-scoped companion

**Locked** 2026-08-08

Not a Q&A utility and not a tutor. A companion you discuss the chapter with — one that **asks you**
questions and follows your thinking, rather than waiting to be queried.

**Locked boundary: exploratory, not evaluative.** No scores, no right answers, no testing. This
distinction is load-bearing: "asks you questions about the chapter" drifts into quizzing very
easily, and quizzing is the gamification layer V1 explicitly deferred.

**Scope:** the currently open chapter only. Not other chapters, not the rest of the book, not the
account. Off-topic requests declined and redirected.

**Rejected — book-wide tutor:** needs cross-chapter retrieval, can spoil chapters not yet reached
(a real product violation once cadence returns), and is the deferred quiz feature wearing a
smaller feature's clothes.

**Technical shape** (deliberately cheap): the whole chapter's `text_content` in the system prompt
— no retrieval, no chunking, no embeddings. History browser-side for the sitting, nothing
persisted. Claude Sonnet 5 (`claude-sonnet-5`). Non-streaming to start. Cost control per D7.

**Prerequisite that will block Phase 5 if forgotten:** `Chapter.text_content`, extracted with
`pypdf` at upload/seed time.

**Inherited from V1 — the Oracle panel**
- **V1 did:** a floating chatbot added in two unticketed commits straight to main, never planned,
  never wired to a backend.
- **V2 does:** a planned, grounded, bounded companion. V1's UI is visual reference only.
- **Follow V1?** ☐ yes ☑ no

---

## D24 — Companion cost model and vendor neutrality

**Locked** 2026-08-09

### Model: Claude Sonnet 5, with prompt caching as the real cost lever

Anthropic pricing per million tokens (verified 2026-08-09): Haiku 4.5 $1/$5 · **Sonnet 5 $3/$15**
(intro $2/$10 **through 2026-08-31**) · Opus 5 $5/$25 · Fable 5 $10/$50.

**Caching saves more than dropping two model tiers.** D13 puts the whole chapter in the system
prompt on every message, so input dominates. Cache reads cost ~0.1× input price. One 20-message
conversation on a ~10k-token chapter:

| | Uncached | Cached |
|---|---|---|
| Haiku 4.5 | ~$0.23 | ~$0.06 |
| Sonnet 5 (intro) | ~$0.46 | ~$0.12 |
| Sonnet 5 (standard) | ~$0.69 | ~$0.19 |
| Opus 5 | ~$1.15 | ~$0.31 |

Sonnet 5 *cached* is cheaper than Haiku 4.5 *uncached*.

**Prompt caching is a build requirement, not an optimisation.**

**Use the 1-hour cache TTL, not the 5-minute default.** The companion's rhythm is *read a while →
ask → read → ask*; those gaps routinely exceed five minutes, so the default TTL would expire
between questions and pay a fresh cache write each time. The 1-hour TTL costs 2× on writes and
survives the gaps.

**Rejected — Haiku 4.5.** Saves roughly six cents per conversation on a feature whose entire value
is the quality of Socratic dialogue. It also carries a silent failure: the minimum cacheable
prefix is **4096 tokens on Haiku 4.5** (vs 1024 on Sonnet 5, 512 on Opus 5), so a *short* chapter
would fall under the threshold and not cache at all — no error, just full price.

**Budget against $3/$15** — the intro rate ends 2026-08-31.

### Vendor neutrality: a seam, not an abstraction layer

There is exactly **one LLM call site**. Swapping vendors means rewriting one function body. Four
rules keep that true, all free:

1. **No vendor types cross the `services/companion.py` boundary** — `discuss(chapter_text,
   history, question) -> Answer` takes and returns our own types.
2. **Provider and model come from env**, never hardcoded.
3. **The prompt lives in its own file** (D14) — also what makes an honest cross-vendor A/B possible.
4. **`ChatUsage` stores plain input/output token counts** (D21) — vendor-neutral, so cost
   comparison works across providers.

**Rejected — a generic provider interface or a router library (LiteLLM et al).** Three reasons:

- An abstraction over **one call site** is a plugin architecture for a single plugin.
- **It would cost the thing that actually saves money.** Caching works differently on every vendor
  — Anthropic uses explicit `cache_control` breakpoints, OpenAI caches automatically with no
  control surface, Gemini has a separate context-caching API. A generic interface either drops
  caching or leaks all three shapes through it, at which point it isn't an abstraction.
- **The real lock-in is the prompt, not the SDK.** Prompts don't port between model families; a
  Socratic prompt tuned on one model needs re-tuning on another. The SDK swap is an afternoon; the
  companion feeling right again is a week.

**Revisit when:** failover for availability is needed, or cost-comparison on real traffic. The
cheapest version then is a second implementation of `discuss()` selected by env — not an interface
hierarchy.

---

## D14 — The companion never interrupts

**Locked** 2026-08-08

`BUSINESS.md` locks the chamber as uninterrupted — *"no timers, no progress bars, no session
metadata, no nudges. Once you're in, the room respects you."* A companion that speaks first is
structurally a nudge, so its entry point is constrained.

**Locked:** the panel sits closed and silent while you read — nothing pulses, nothing appears.
When *you* open it, the companion speaks first, with a question about the chapter rather than a
greeting. Opening the panel is you leaving the room voluntarily, so the room stays uninterrupted.

**Leading candidate to revisit:** also offering a question at the **end** of a chapter — the same
mechanic at the natural pause, turning "finished the chapter" into a conversation. The `finished`
state in the reader machine exists as its anchor.

**Rejected — ambient prompting** (noticing you have lingered on a page and surfacing a question):
exactly the scroll-culture interruption the product sells relief from.

**Open — its own design session:** the interaction model in full, and **the system prompt**, which
is a versioned deliverable with real iteration in its own file. The difference between a good and
a bad companion here is almost entirely prompt craft.
