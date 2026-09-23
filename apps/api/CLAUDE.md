# CLAUDE.md — apps/api

Django 6 + Django Ninja + Postgres. Serves `api.<domain>`.

Root context: `../../CLAUDE.md`. Design and decisions: `../../DESIGN.md`.

## Layering — strict

| Layer | Holds | Never |
|---|---|---|
| `core/api/*` | HTTP only. Ninja schemas in and out. Request → event, result → status. | business logic, guards |
| `core/machines/*` | **the flow** — states, events, guards, transition tables | ORM, HTTP, network, Django imports |
| `core/services/*` | **the effects** — all business I/O, the three seams | deciding what happens next |
| `core/models.py` | data | orchestration |

**Flow and effects are separate layers** (D36). A service does the work; a machine decides when it
is called. `core/machines/` imports nothing from Django — `machines/binding.py` is the only
Django-aware module in the layer, which is what keeps the logic portable and testable without a
database (D37).

Refusals travel as codes on a `TransitionResult` and become status codes in `core/api/*` (D38).
No layer below the API knows what a 403 is.

Services must be callable from the API, Django admin, management commands, and later from
webhooks and schedulers. If a service needs `request`, it's in the wrong layer — that's what makes
the Stripe webhook a drop-in later (D10).

## Adding behaviour — follow the machine, every time

**The question before any new endpoint or action: which machine owns this subject?**

| Subject | Machine | Events today |
|---|---|---|
| a `TemporalGrant` | `core/machines/reading/` | `UNLOCK` · `OPEN` · `RECORD_PROGRESS` · `COMPLETE` · `REISSUE` · `WATCH` |
| a purchase attempt | `core/machines/acquisition/` | see its table |
| a `MessageLog` | `core/machines/delivery/` | see its table |

If the subject has a machine, the behaviour is **rows in its table**, even when no state changes:

1. **Add the rows.** One success row with its guards, and one refusal row per refusal code,
   mirroring how `OPEN` refuses (`is_past_expiry` → `expired`, then the catch-all `not_owner`). An
   action that changes nothing on the grant is still a row: `dest: None`.
2. **Effects go in an action** that calls a service through `ctx.deps`
   (`ctx.deps.record_progress(...)`), never an import. Wire the callable once, in the endpoint
   module's `_deps()`.
3. **The endpoint dispatches and maps**: `_dispatch_or_refuse(grant, "EVENT", **payload)` in
   `core/api/grants.py`. The payload arrives in actions as `ctx.payload`.
4. **Reads go through `core/selectors.py`**, not the ORM in `api/` (D61).
5. **Tests:** one test per new row in `tests/test_<machine>_machine.py`, with no database (stub
   subject, stub `deps`), plus an endpoint test for the status codes.

**Never do this:**

- **Call a service from an endpoint to perform a flow step.** The flow then lives in two places:
  a table nobody calls, and an `if` in a view (PLAN F1/F3). This is the failure D36 exists for.
- **Dispatch one event to borrow its checks for another** (e.g. `OPEN` as an access check before
  a progress write). It runs the wrong row's actions and hides the real action from the table.

**Not machine work:** something with no subject in a flow. Rendering a chapter's pages at upload
(`services/pages.py`) or extracting its text is a service called from admin, `seed_dev` or a
command.

**Known exception, do not copy:** `POST /api/grants/{token}/reissue` (`core/api/read.py`) calls
`grants.reissue` directly, although the reading machine has `REISSUE` rows. It predates this rule
and moves in the rebuild (D69).

## The three seams

**Unchanged by D36.** Machines decide *when* a seam is called; nothing bypasses one.

Signatures and reasoning: **D25, D26, D27** in `../../decisions/07-seams.md`. Summary:

```python
grants.validate(token)  -> TemporalGrant | None    # is this token live?
access.can_read(user, chapter) -> bool             # does this person own the book?

onboarding.create_reader(full_name, email, phone, book, pace) -> OnboardingResult

whatsapp.send_chapter(grant)              -> MessageLog
whatsapp.send_password_reset(reset_token) -> MessageLog
```

- **`can_read` is ownership only, and returns a plain bool.** No caller queries `Order` or
  `TemporalGrant` directly. Cadence extends *this function*; it never adds a parallel check.
  Refusals become 403s at the API layer — services hold no HTTP concerns.
- **A live token is never sufficient.** Grant-authenticated requests validate the token *and* check
  the `Order`, so revocation takes effect on the next request.
- **`create_reader` is the only way a reader begins.** Three rows atomic; delivery outside the
  transaction; the result carries the `MessageLog` so admin can see a failed send. Never call it
  from inside an outer `atomic()` block.
- **Callers mint, `send_chapter` delivers.** Home reuses a live grant, sanctuary mints a fresh one
  — that decision belongs to the caller, not to a `force_new` flag.
- **Delivery failures return a `MessageLog`; they never raise.** That is what makes D17's "a Twilio
  failure never breaks the transaction" structural rather than a convention five callers must
  remember. Bugs — an unknown template key — still raise.

## Data model

```
User ──< Order >── Book ──< Chapter ──< TemporalGrant >── User
                                 │
                            (PDF file, text_content)
MessageLog >── User, TemporalGrant
```

Departures from V1 (no `Shard` table, no view quota, `grant.user` required) and their rationale:
`DESIGN.md` D4. Don't reintroduce them without updating that block.

## Mandates

1. **Temporal security** — never expose a storage URL, and never send the PDF. A reader receives
   watermarked page images through `GET /api/grants/{token}/pages/{n}` (D73, superseding D29).
   This is also what keeps object storage swappable: nothing outside this app knows where files
   live. **One exception, video (D77):** a chapter or sample video plays from a short-lived signed
   R2 URL minted in `services/media.py`, the only module that makes one. Covers are proxied.
2. **Type-safe API** — Ninja schemas on every request and response body. No untyped dicts crossing
   the boundary.
3. **Env-driven externals** — Twilio, Anthropic, Stripe, storage and `DATABASE_URL` all read from
   env, each with a console/no-op fallback. `python3 manage.py test core` must pass with zero
   credentials and must never hit the network.
4. **Config, not literals** — WhatsApp template copy and the companion system prompt live in their
   own files (D12, D14), editable without touching send or call logic.

## File structure

```
apps/api/
├── manage.py · requirements.txt · .env.example
├── config/                        the Django project
│   ├── settings.py                single file, env-driven
│   ├── urls.py                    mounts Ninja at /api/
│   └── asgi.py · wsgi.py
└── core/                          ONE app
    ├── models.py                  single file for now
    ├── admin.py
    ├── api/                       HTTP only
    │   ├── __init__.py            NinjaAPI instance + router registration
    │   └── auth.py · home.py · grants.py · chat.py · health.py
    ├── schemas/                   Pydantic request/response bodies
    ├── services/                  ALL business logic
    │   ├── access.py              can_read()            ← seam
    │   ├── onboarding.py          create_reader()       ← seam
    │   ├── whatsapp.py            send_chapter()        ← seam
    │   ├── grants.py              mint_or_reuse / validate / reissue
    │   ├── companion.py           chat completion + caps
    │   └── extraction.py          pypdf → text_content, page_count
    ├── content/                   editable copy, no logic
    │   ├── templates.py           WhatsApp templates (D12)
    │   └── companion_prompt.md    the system prompt (D14)
    ├── auth/                      SessionAuth · GrantAuth
    ├── management/commands/       seed_dev.py · send_chapter.py
    ├── migrations/
    └── tests/
```

**One Django app, not several.** Eight models don't justify cross-app migration dependencies and
app-registry ordering. Domains are modules within `core`, the same way the frontend expresses them
as folders within `src`.

**`models.py` stays a single file for now.** Moving model classes into a package later costs
nothing — same `app_label`, no migration impact — so splitting today buys nothing. `api/`,
`schemas/`, and `services/` are packages from day one because they genuinely have many members.

**`config/` replaces V1's `sapien_backend/`** so the project package and the app don't sound like
siblings.

## API surface

| Endpoint | Auth | Purpose |
|---|---|---|
| `GET /api/health` | none | deploy check |
| `POST /api/auth/login` | none | sets the session cookie |
| `POST /api/auth/logout` | session | |
| `GET /api/auth/me` | session | `checkSession`; 401 when anonymous |
| `POST /api/auth/reset/request` | none | sends a WhatsApp reset link (D16) |
| `POST /api/auth/reset/confirm` | reset token | single-use (D21) |
| `GET /api/home` | session | user + books + chapters. **No tokens in the payload** (D11) |
| `GET /api/read/{chapter_id}` | session | mint-or-reuse → `{ token }` |
| `POST /api/chapters/{id}/send` | session | send to my WhatsApp (D11), rate-limited |
| `GET /api/grants/{token}` | **grant** | validate, chapter meta, stamp `opened_at` |
| `GET /api/grants/{token}/pages` | **grant** | page sizes + sections, no storage paths (D73) |
| `GET /api/grants/{token}/pages/{n}` | **grant** | one watermarked page image, `no-store` (D73) |
| `POST /api/grants/{token}/progress` | **grant** | `RECORD_PROGRESS` on the reading machine (D70) |
| `POST /api/grants/{token}/complete` | **grant** | `COMPLETE` on the reading machine (D70) |
| `GET /api/grants/{token}/video` | **grant** | `WATCH` → signed video URL, 404 if none (D76, D77) |
| `POST /api/grants/{token}/reissue` | **grant** | one-tap fresh link (D9), rate-limited |
| `GET /api/books/{slug}/cover` | none | proxied cover image, published books only (D76) |
| `GET /api/books/{slug}/sample` | none | signed URL for the public sample video (D76, D77) |
| `POST /api/chat` | **grant** | companion, capped and logged (D7) |

**Two Ninja auth classes**, mirroring the frontend's two dimensions: `SessionAuth` (Django session)
and `GrantAuth` (resolves the token from the path, checks expiry). **Each endpoint declares exactly
one. No endpoint accepts both.**

## API-layer rules — all locked

See **D29–D33** in `../../decisions/09-api-layer.md`.

- **Chapter pages are `GET /api/grants/{token}/pages` (layout) and `/pages/{n}` (a watermarked
  image)** (D73). There is no PDF endpoint; D29's `/pdf` is gone. The token sits in the path, not
  the query string, so it stays out of referrer headers and access logs — it is a credential (D22).
- **CSRF is enforced on session endpoints and exempt on grant-authenticated ones** (D30). CSRF
  defends *ambient* authority; a grant token is not ambient, and enforcing it would break the
  cookie-less WhatsApp visitor entirely.
- **Rate limits count existing rows** in `MessageLog`, `PasswordResetToken`, and `ChatUsage` within
  a window read from env (D31). No Redis (D17) — the tables already hold the truth.
- **`GET /api/read/{chapter_id}` stays a GET and is idempotent** (D32): reuse a live grant, mint
  only when none exists. A POST would mean an interstitial screen on the path to reading.
- **The companion's caps live in `services/companion.py`**, not the endpoint (D33), so every future
  caller inherits them rather than having to remember them.

## Commands

```bash
python3 manage.py runserver          # :8000
python3 manage.py makemigrations core && python3 manage.py migrate
python3 manage.py test core
python3 manage.py seed_dev           # idempotent
python3 manage.py send_chapter --email=… --chapter=1
```

## Pitfalls from V1

- **Callable defaults on model fields.** V1 lost a full ticket to `shortuuid.uuid` vs.
  `ShortUUID.uuid` — an unbound method as a field default broke every insert at runtime, and
  Django's autodetector then looped proposing the same migration forever. Use a module-level
  wrapper function so the migration records a stable import path.
- **Run `makemigrations --check` before every PR.** Migration drift on master blocked several
  tickets in V1.
- **Don't let logic accumulate in `admin.py`.** Admin actions call services (D10) — that's what
  makes payments additive later.
