# Sapien Paradox V2 — Design

> What we're building and how it fits together.
>
> **Decisions and their reasoning live in `decisions/`, not here.** This file references them by
> number (D1, D19, …). If you want to know *why* something is the way it is, follow the number.
> Current focus and open questions live in `STATUS.md`.

**Locked through Level 1** (frontend and backend data layer). Level 3 detail — copy, validation,
animation, prompt craft — is deferred by decision to the point each feature is built.

---

## 1. The product

A modular, cadence-paced learning platform for "Intellectual Explorers." A reader buys a book; its
chapters unlock on a schedule; each arrives by WhatsApp as a self-authenticating link; they read it
in a token-gated chamber and discuss it with a companion. Depth over velocity, digital monasticism,
temporal delivery.

**Personas:** Reader (the whole product) · Admin (Django admin only, no custom UI yet).

**V2 is the same product as V1** (D1), rebuilt so every piece is deliberate. Payments and cadence
are **sequenced later, not dropped**.

---

## 2. Scope

```
├── 0. Foundations   monorepo · deployed skeleton · labels · seed
├── 1. Login         email + password, session that survives refresh
├── 2. Home          account block + chapter list + send-to-WhatsApp
├── 3. Reader        token-gated chamber + sanctuary
├── 4. WhatsApp      delivery, recovery, password reset
└── 5. Companion     chapter-scoped discussion partner
```

These are the **first slices of the real product**.

### Sequenced later — seams already in place

| Later | Plugs into |
|---|---|
| Payments (Stripe) | `onboarding.create_reader(...)` |
| Cadence | `TemporalGrant.unlock_at` + `access.can_read` |
| Reminders | `opened_at` + a pre-approved template |
| Subscriptions | `access.can_read` |
| Admin tooling | `core/services/*` |
| Public signup | replaced by concierge onboarding (D10) |

**The one structural consequence of cadence arriving later:** nothing computes a future unlock time
yet, so every chapter is available immediately. `unlock_at` exists and stays null.

---

## 3. Architecture

### 3.1 System shape

```
                    ┌──────────────────────────┐
   app.<domain> ───▶│  React SPA (Vite)        │
   (static host)    │  labels.ts · XState      │
                    └────────────┬─────────────┘
                                 │  fetch, credentials: include
                                 │  cookie scoped to .<domain>
                    ┌────────────▼─────────────┐
   api.<domain> ───▶│  Django 6 + Ninja        │
                    │  core/api/ · services/   │
                    └──┬────────┬────────┬─────┘
              ┌────────▼──┐ ┌───▼────┐ ┌─▼──────────┐
              │ Postgres  │ │ Object │ │ Twilio     │
              │ (managed) │ │ storage│ │ Anthropic  │
              └───────────┘ │ (PDFs) │ │ Stripe(→)  │
                            └────────┘ └────────────┘
```

Two origins under one parent domain (D6). Five external systems, **no email provider** (D16).
Monorepo; `shared/constants.json` is read by both sides (D20).

### 3.2 Layering

**Backend** — `core/api/*` is HTTP only (Ninja schemas in and out, no business logic) ·
`core/services/*` holds all business logic, callable from API, admin, CLI, and later webhooks and
schedulers · `core/models.py` is data only. **Nothing imports upward.** A service that needs
`request` is in the wrong layer.

**Frontend** — three levels: root machine (session + which page) · page machines · component
machines (D15). Nothing from a lower level appears in a higher one.

### 3.3 Data model

```
User ──< Order >── Book ──< Chapter ──< TemporalGrant >── User
                                 │
                            (PDF file, text_content)
MessageLog >── User, TemporalGrant
ChatUsage  >── TemporalGrant
PasswordResetToken >── User
```

Eight tables. Full field-level specs and rationale: **D18, D19, D21**. Departures from V1: **D4**.

### 3.4 The three seams

Everything routes through these; nothing bypasses them. This is what makes payments and cadence
drop-ins rather than second implementations.

**`access.can_read(user_or_token, chapter) -> bool`** — the only access check. Today: does an
`Order` exist, and is the grant unlocked and unexpired? Cadence adds an `unlock_at` comparison;
subscriptions add an alternative path. **No caller queries `Order` or `TemporalGrant` directly.**

**`onboarding.create_reader(name, email, phone, book, pace)`** — the only way a reader comes into
existence. User + Order + first grant atomically, delivery post-commit. Called by Django admin and
`seed_dev` today; by the Stripe webhook later.

**`whatsapp.send_chapter(grant)`** — the only delivery path. Five triggers today (D12), cadence
adds another.

*Anything a human can do in Django admin, a service function does.*

### 3.5 Future domains — the seam and the constraint

**Payments (Stripe).** Webhook calls `onboarding.create_reader(...)` in a transaction, delivery
post-commit. **Constraint today:** onboarding stays a single service function with no `request`
dependency, and `Order` must be creatable without an authenticated session — at webhook time there
is no logged-in user.

**Cadence.** A scheduled job walking open orders, minting a grant for any chapter whose unlock time
has arrived (`Order.created_at + (N-1) × delay`) and calling `whatsapp.send_chapter`.
**Constraint:** `unlock_at` exists and is nullable, `access.can_read` is the only access check,
`pace` stays on `Order`. Unlocks are schedule-driven, never read-completion-driven — do not couple
anything to `opened_at`. Mechanism: a management command on the host's cron (D17).

**Reminders.** One WhatsApp nudge per chapter ~24h after unlock if `opened_at` is null.
**Constraint:** `opened_at` stamped on first open, and the template pre-approved — which is why it
ships in the first submission batch (D12).

**Subscriptions.** **Constraint:** `access.can_read` must be able to answer "yes" via a path that
isn't an `Order` row.

**Catalog / multi-book.** Already handled — `Order` is per-book, Home groups by book (D11).

**Admin tooling.** **Constraint:** none, provided operations stay in `core/services/*` rather than
accumulating inside Django admin classes.

**Streaming chat.** **Constraint:** keep the chat request/response shape stable and the transport
swappable.

---

## 4. The features

### 4.0 Foundations
Monorepo, both apps deployed, label systems, seed data, env config.
**Critical path:** Phase −1 lead-time items — Twilio sender application, **four** Meta template
submissions, domain registration. None are engineering; all block the Phase 4 demo.

### 4.1 Login
`/login`, email + password, Django session. `POST /api/auth/login` · `POST /api/auth/logout` ·
`GET /api/auth/me`. No public signup — readers are created by concierge onboarding (D10).
Password reset over WhatsApp (D16).

*V1 shipped without session persistence and filed it as a future note. V2 rehydrates from
`GET /api/auth/me` on boot.*
**Most likely to break quietly:** the cross-subdomain cookie (D6). Test on Safari — ITP kills this,
and localhost never reveals it.

### 4.2 Home
Account block + chapter list. `GET /api/home` (no tokens in the payload). Links go to
`/read/:chapterId` which mints-or-reuses then redirects (D11). Each chapter also has a
send-to-WhatsApp action.

### 4.3 Reader
`/r/:token`. `GET /api/grants/:token` (validate, chapter meta, stamp `opened_at`) + proxied PDF
bytes. States: loading → reading → finished; invalid/expired → sanctuary; network error.
**Token alone authenticates — no session required.**

**Sanctuary is a primary flow, not an edge case.** With 7-day expiry (D8), anyone opening a
WhatsApp message a week late lands here, on a phone with no session. Hence one-tap recovery (D9).

**Design intent** (from V1's `BUSINESS.md`, still binding): Apple-clean, not fancy. Uninterrupted —
no timers, no progress bars, no session metadata, no nudges. Auto-fading chrome. Threshold ceremony
on first entry per token. Soft expiry, no shouting.

*V1 reference: three competing implementations exist there. Only `pages/reading-room/` is real.*

### 4.4 WhatsApp
One `whatsapp.send_chapter(grant)` for every trigger. Twilio in production, console fallback with
no credentials. `MessageLog` records every send. Four templates (D12). Bounded in-request retry,
no queue (D17).

### 4.5 Companion
A chapter-scoped discussion partner that asks *you* questions — exploratory, not evaluative (D13).
Never interrupts (D14). `POST /api/chat`, token-gated and capped (D7). Whole chapter in the system
prompt; no retrieval. Claude Sonnet 5.

**Prerequisite that will block this phase if forgotten:** `Chapter.text_content`.

---

## 5. Conventions

1. **Zero hardcoded strings** — UI text via `labels.ts`; message templates and the companion prompt
   in their own config files.
2. **Machine-first logic** — XState with the 5-file split (+ `types.ts`, D3).
3. **Temporal security** — never expose a storage URL; always proxy. Also what keeps object storage
   swappable.
4. **Type-safe API** — Ninja schemas on every body; no untyped dicts, no `as any`.
5. **Variable Velocity** — animations start fast, settle slow.
6. **Env-driven externals** — everything touching the outside world reads env and has a
   console/no-op fallback.

---

## 6. Roadmap

Each phase is an independently demoable vertical slice, **deployed** (D5). A phase is done when its
demo is true on the deployed instance, not just locally.

| Phase | Build | Demo |
|---|---|---|
| **−1** | Twilio sender application · **four** Meta templates · domain + DNS · Anthropic key · Stripe test account | applications in, domain resolves |
| **0** | Monorepo, Django + Ninja, `DATABASE_URL`, `django-storages`, Vite + React + XState, `labels.ts`, `shared/constants.json`, path-filtered CI, **both sides deployed** | `api.<domain>/api/health` 200 in production; a fresh clone runs with zero credentials |
| **1** | Auth endpoints, `/login` + machine, boot rehydration, cookie scoped to parent domain | log in on the deployed app, refresh, new tab — still logged in, **on Safari** |
| **2** | Eight models + migrations, the three seams, `GET /api/home`, `/read/:chapterId`, Home screen, Django admin onboarding, `seed_dev` with PDFs in object storage | create a reader through admin on the deployed instance, log in as them, see the chapters |
| **3** | Grant + PDF endpoints, `/r/:token` with `react-pdf`, sanctuary, 7-day expiry | read from Home; the same URL in a logged-out private window still works; hand-expire a grant and get sanctuary |
| **4** | Twilio + console backends, `MessageLog`, admin action, CLI, sanctuary re-issue, Home send | a real message on a real phone with a working link; recover an expired link in one tap |
| **5** | `text_content` extraction, `POST /api/chat`, caps and logging, the panel, versioned prompt file | open the panel and it opens with a question; it follows the thread; off-topic declines gracefully |
| **6** | End-to-end test, complete seed, `docs/HOW_TO_START.md` | fresh clone → one seed command → whole flow works locally and deployed |

```
−1 ──▶ 0 ──▶ 1 ──▶ 2 ──┬──▶ 3 ──▶ 5 ──┐
   (waiting runs        │              ├──▶ 6
    in parallel)        └──▶ 4 ────────┘
```

Phase 4's *demo* depends on Phase −1 clearing; its *build* does not.
