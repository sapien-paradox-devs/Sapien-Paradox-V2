# Backend build order

The ordered plan for building `apps/api`. **What** to build is `CLAUDE.md` (structure, API
surface, layering) and `../../decisions/`. This file is only **the order, the verification, and
what each step forces us to decide.**

Rule for every step: it ends with a command that passes. No step is "done" because files exist.

---

## Ground state

| | |
|---|---|
| Written | `manage.py` · `requirements.txt` · `config/{settings,urls,wsgi,asgi}.py` · `../../shared/constants.json` |
| Missing | all of `core/` · `.env.example` · `config/logging.py` |
| Broken | `settings.py` names `config.logging.JsonFormatter`, which doesn't exist — `manage.py check` fails today |

Nothing is committed.

---

## Gates — decisions that block later steps

Steps 0–3 are unblocked. These must close before the step named.

| # | Question | Blocks | Proposed |
|---|---|---|---|
| ~~G1~~ | PDF endpoint name | S7 | `GET /api/grants/{token}/pdf`. `Shard` doesn't exist (D4); `CLAUDE.md` mandate 1 still says otherwise and is stale |
| ~~G2~~ | CSRF policy | S4 | enforce on session endpoints, exempt grant-authenticated ones — CSRF defends *ambient* cookie authority, a grant token isn't ambient |
| ~~G3~~ | ~~**The three seams**~~ | ~~S5~~ | **CLOSED** 2026-08-25 — D25, D26, D27 in `../../decisions/07-seams.md` |
| ~~G4~~ | Rate-limit mechanism | S5 | count rows in `MessageLog` / `PasswordResetToken` within a cooldown window; window lengths already in `settings.py`, env-overridable. No Redis (D17) |
| ~~G5~~ | Is `GET /api/read/{id}` honest as a GET? | S6 | keep GET, make it idempotent — reuse a live grant, mint only when none exists |
| ~~G6~~ | Where chat caps live | S10 | `services/companion.py`, so the CLI and any future caller inherit them |

**All gates are now closed.** G3 became D25–D27; G1, G2, G4, G5 and G6 became D29–D33. Originally: The rest are one-line answers; the seams are a design session.

---

## S0 — Environment

`.venv`, dependencies, `.env.example`, `config/logging.py`.

`.env.example` enumerates every variable `settings.py` reads, with the dev-safe value. A fresh
clone must run with **zero credentials**: SQLite, filesystem storage, console WhatsApp, no
Anthropic key.

**Verify:** `python3 manage.py check` — exit 0.

---

## S1 — The eight tables

`core/` app · `core/constants.py` (loads `shared/constants.json`, D20) · `core/models.py` (D19,
D21) · initial migration.

Watch for:
- **Token defaults are module-level wrapper functions**, never `shortuuid.uuid` directly. V1 lost a
  full ticket to this — a bound method as a field default breaks every insert and sends the
  autodetector into an infinite migration loop.
- `TemporalGrant (user, chapter)` is indexed but **NOT unique** — re-issue mints a new row so old
  tokens die. This looks wrong and is deliberate (D21).
- `Chapter.file` upload path is a callable producing `chapters/<slug>/<index>-<uuid>.pdf`.
- No `Shard`, no view quota, `grant.user` required (D4).

**Verify:** `makemigrations --check --dry-run` clean · `migrate` on SQLite · a test creating one
row of each model.

---

## S2 — Admin

Register all eight. Concierge onboarding is the *entire* way readers exist (D10), so this is a
product surface, not a debug tool: list displays, search on email/phone, filters.

**No logic in `admin.py`** — actions call services. That's what makes the Stripe webhook additive.
Actions themselves land in S8.

**Verify:** `createsuperuser`, admin renders every model.

---

## S3 — API skeleton

`core/api/__init__.py` (the `NinjaAPI` instance + router registration) · `core/api/health.py` ·
`core/schemas/`.

**Verify:** `GET /api/health` → 200. This is also the deploy check, so it stays trivial and
touches nothing external.

---

## S4 — Auth · *gated on G2*

`core/auth/` — `SessionAuth`, `GrantAuth` · `core/api/auth.py` — login, logout, me.

Two auth classes, **each endpoint declares exactly one, no endpoint accepts both** (D7).
`GrantAuth` resolves the token from the path and checks expiry — it is the whole reason WhatsApp
links work in an in-app browser with its own cookie jar.

Reset request/confirm wait for S8 (they need WhatsApp to deliver).

**Verify:** tests — login sets the cookie, `me` 401s anonymous, a session cookie can't open a
grant endpoint and vice versa.

---

## S5 — The three seams · *gated on G3, G4*

`services/access.py` · `services/onboarding.py` · `services/grants.py`

- `access.can_read(user_or_token, chapter)` — the only access check. **No caller queries `Order` or
  `TemporalGrant` directly.**
- `onboarding.create_reader(name, email, phone, book, pace)` — User + Order + first grant
  atomically, delivery **post-commit**.
- `grants.mint_or_reuse / validate / reissue`.

Services never see a `request`. If one needs it, it's in the wrong layer.

**Verify:** unit tests calling them directly, no HTTP client. If the seams need the test client,
the layering already failed.

---

## S6 — Home and read · *gated on G5*

`GET /api/home` — account block, books, chapters, read/unread from `opened_at`.
**No tokens in the payload** (D11).
`GET /api/read/{chapter_id}` — `can_read` → `mint_or_reuse` → `{ token }`.

**Verify:** tests — home for a reader with one book; read returns a live token; read on an unowned
chapter 403s.

---

## S7 — Grants and PDF bytes · *gated on G1*

`GET /api/grants/{token}` — validate, chapter meta, stamp `opened_at` (**first** open only).
`GET /api/grants/{token}/pdf` — `StreamingHttpResponse`, chunked.

**Never expose a storage URL.** Reading a 10 MB PDF into memory per concurrent reader is how a
small instance falls over — chunk it.

**Verify:** tests — expired token 401s · valid token streams bytes · `opened_at` doesn't move on
the second open · nothing in the response resembles a storage URL.

---

## S8 — WhatsApp

`content/templates.py` (D12) · `services/whatsapp.py` · `MessageLog` writes · admin action ·
`manage.py send_chapter` · reset request/confirm from S4.

- **Console backend when unconfigured.** Local work and CI never touch the network.
- Bounded retry **inside the request**: 3 attempts, 0.5s → 1.5s. Retry transient only — network,
  429, 5xx. **Never retry 4xx** (D17).
- Write `MessageLog` as `pending` *before* the attempt, update in place, so a crash leaves evidence.
- **Never store the rendered body** — it contains a live token.

**Blocked outside the code:** the four template copies need Meta approval, days to weeks. That
gates the demo, not this step.

**Verify:** tests against the console backend — a 5xx retries and succeeds, a 4xx doesn't retry,
`MessageLog` reflects both.

---

## S9 — Extraction and seed

`services/extraction.py` (pypdf → `text_content`, `page_count`) · `manage.py seed_dev`.

**Extraction is an explicit call, never a `post_save` signal** (D19) — a hidden 40-page parse
behind `.save()` is a surprise found in production.

`seed_dev` is idempotent and calls `onboarding.create_reader`, the same path admin uses.

**Verify:** `seed_dev` twice in a row, same result.

---

## S10 — The companion · *gated on G6*

`content/companion_prompt.md` (versioned, D14) · `services/companion.py` · `POST /api/chat` ·
`ChatUsage`.

- **Prompt caching is a build requirement, not an optimisation** (D24), with the **1-hour TTL** —
  the read → ask → read rhythm blows past the 5-minute default and would pay a fresh cache write
  every question.
- Caps built in from the start, not bolted on: per-grant daily, global daily kill switch, max input
  length. This is the only endpoint that is token-authenticated **and** spends money per call.
- `ChatUsage` stores counts and tokens, **never message content** (D18).

**Verify:** tests with a stubbed client — caps reject at the boundary, `ChatUsage` rows are
accurate, no network.

---

## S11 — CI and deploy

`.github/workflows/` with a path filter on `apps/api/**` · Render web service + managed Postgres ·
`DATABASE_URL`, R2 credentials, `COOKIE_DOMAIN`.

**Never a tier that sleeps** (D23) — a cold start means a reader taps a WhatsApp link and stares at
a blank screen for 50 seconds.

**Deploy checklist: the bucket must be private.** A public bucket bypasses grants, expiry, and the
whole temporal-security design at the infrastructure layer while the code still looks correct.

**Verify:** `GET https://api.<domain>/api/health` → 200.

---

## Order

```
S0 → S1 → S2 → S3 → S4 → S5 → S6 → S7 → S8 → S9 → S10 → S11
                          │      └──────┴──── S7 and S8 are independent
                          └── G3 grilling happens here, before any service code
```

S11 can run early against a stub — D5 says deploy first, and proving the pipeline while there is
nothing to lose is the point.

---

## Housekeeping, unrelated to the code

- `ALL_DOCUMENTATION.md` (2,635 lines) and `UNIFIED_SPEC.md` (787 lines) are concatenated copies of
  the six real documents. Duplication is what killed V1. Delete both, or mark them generated.
- `README.md` is empty.
- `CLAUDE.md` mandate 1 cites `/api/shards/stream/` — a V1 route for a table D4 deleted. Fix with G1.
- Nothing is committed.
