# CLAUDE.md — apps/api

Django 6 + Django Ninja + Postgres. Serves `api.<domain>`.

Root context: `../../CLAUDE.md`. Design and decisions: `../../DESIGN.md`.

## Layering — strict

| Layer | Holds | Never |
|---|---|---|
| `core/api/*` | HTTP only. Ninja schemas in and out. | business logic |
| `core/services/*` | all business logic | HTTP concerns, `request` objects |
| `core/models.py` | data | orchestration |

Services must be callable from the API, Django admin, management commands, and later from
webhooks and schedulers. If a service needs `request`, it's in the wrong layer — that's what makes
the Stripe webhook a drop-in later (D10).

## The three seams

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
MessageLog >── User, Chapter
```

Departures from V1 (no `Shard` table, no view quota, `grant.user` required) and their rationale:
`DESIGN.md` D4. Don't reintroduce them without updating that block.

## Mandates

1. **Temporal security** — never expose a storage URL. PDFs are always proxied through
   `/api/shards/stream/`. This is also what keeps object storage swappable: nothing outside this
   app knows where files live.
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
| `GET /api/grants/{token}/pdf` | **grant** | proxied bytes — *name pending, see below* |
| `POST /api/grants/{token}/reissue` | **grant** | one-tap fresh link (D9), rate-limited |
| `POST /api/chat` | **grant** | companion, capped and logged (D7) |

**Two Ninja auth classes**, mirroring the frontend's two dimensions: `SessionAuth` (Django session)
and `GrantAuth` (resolves the token from the path, checks expiry). **Each endpoint declares exactly
one. No endpoint accepts both.**

## Open — four API-layer questions (not yet decided)

1. **PDF endpoint name.** V1 used `/api/shards/stream/?token=`, but D4 deleted the `Shard` table.
   Proposed `GET /api/grants/{token}/pdf` — grant-centric and consistent with the sibling routes.
2. **CSRF policy.** D6 puts the SPA and API on sibling subdomains, so session POSTs need CSRF:
   `CSRF_COOKIE_DOMAIN=.<domain>`, SPA sends `X-CSRFToken`. Proposed: **enforce on session
   endpoints, exempt the grant-authenticated ones** — CSRF defends *ambient* cookie authority; a
   grant token isn't ambient, and enforcing it would break the cookie-less WhatsApp visitor
   entirely.
3. **Where the chat caps live.** Proposed `services/companion.py`, not the API layer, so the CLI
   and any future caller inherit them.
4. **Is `GET /api/read/{chapter_id}` honest as a GET?** It can mint a grant. Proposed: keep GET and
   make it **idempotent** — reuse any live grant, mint only when none exists. The frontend
   navigates to it directly; a POST would mean an interstitial.

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
