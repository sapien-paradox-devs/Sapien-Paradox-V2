# Status

> Current focus and open questions. Changes every session.
>
> **Decisions are not here.** `decisions/` holds every locked decision with its reasoning, indexed
> by number in `decisions/README.md`. This file tracks only what is *open*.
>
> **This is not a diary.** V1's equivalent accumulated a 24-entry narrative log nobody could use.
> If something matters, it is a decision; if it isn't, it doesn't belong.

**Last updated:** 2026-08-09

---

## Where we are

**Planning. Design locked through Level 1 on both sides.**

| Area | State |
|---|---|
| Product, scope, roadmap | locked — D1, D2, D8–D14 |
| Infrastructure, external systems | locked — D5, D6, D16, D17, D20 |
| Frontend architecture + root machine | locked — D15, spec in `apps/web/CLAUDE.md` |
| Backend layering, structure, data model | locked — D4, D18–D21, spec in `apps/api/CLAUDE.md` |
| **The three seams, in detail** | **not started** |
| API layer | proposed, four questions open |
| Level 3 detail (copy, validation, animation, prompts) | deferred by decision |

**Code:** none, except `apps/web/src/pages/machine/{machine,types}.ts` written during design as
the reference shape. **Nothing is committed** — `git init` only, no remote.

## Next action

Two tracks, independent:

**1. Phase −1 — start the clock.** Nothing here is engineering; it is all lead time, and it blocks
the WhatsApp demo.
- Close the message-template copy (open #1) — it gates Meta submission
- Apply for the Twilio WhatsApp sender; submit **all four** templates
- Register the domain; point `app.` and `api.` at hosts
- Anthropic API key; Stripe test account

**2. Continue design — the three seams.** `access.can_read`, `onboarding.create_reader`,
`whatsapp.send_chapter`. Everything routes through them, so they deserve the same grilling the
tables got. The API layer is thin once they are settled.

## Open questions

| # | Question | Blocks | Default if unanswered |
|---|---|---|---|
| 1 | **Message template copy** (4 templates) | **Meta approval → Phase 4 demo** | drafted in `BUSINESS.md` register for review |
| 2 | Domain name | Phase −1 | — must be chosen |
| 3 | Hosts for `app.` and `api.` | Phase 0 | Cloudflare Pages / Render + managed Postgres + R2 |
| 4 | Companion interaction design + system prompt | Phase 5 | its own session (D14) |
| 6 | Read/unread mark on Home — keep or drop | Phase 2 | keep (D11) |
| 7 | Push to GitHub under `sapien-paradox-devs`? | when convenient | not pushed — your call |
| 8 | Commit the plan | now | uncommitted on disk |
| 9 | **What does an anonymous visitor see at `/`?** Home is openable logged-out. Either it renders a visitor view (V1's landing page returning) or it redirects to `/login`. Amends D7/D11 | Phase 2 | redirect to `/login` |
| 10 | **Is a signup page in scope?** Contradicts D10 | Phase 1 | no — D10 stands |
| 11 | PDF endpoint name — `/api/grants/{token}/pdf` vs V1's stale `/api/shards/stream/` | Phase 3 | rename (`Shard` no longer exists) |
| 12 | CSRF policy — enforce on session endpoints, exempt grant-authenticated ones | Phase 1 | as proposed |
| 13 | Where chat caps live — `services/companion.py` vs API layer | Phase 5 | service layer |
| 14 | Is `GET /api/read/{id}` honest as a GET? | Phase 2 | keep GET, make it idempotent |

*(#5 closed — XState conventions, now in `apps/web/CLAUDE.md` and D3.)*

**#9 and #10 are coupled:** a public `/` with a signup path is a coherent product; a gated `/` with
signup isn't.

## V1 is read-only reference

`../Sapien Paradox App`. Consult it for working code (Stripe service, auth endpoints,
reading-room machine, `labels.ts`) and for the `Inherited from V1` blocks. The full audit of what
went wrong is `decisions/00-why-v2.md`. **Nothing is carried over without a decision recorded.**

**Do not trust V1's own documentation.** Its `frontend/CLAUDE.md` lists `src/lib/fetcher.ts` in the
architecture map; the file does not exist. Verify before relying on it.
# Sapien Paradox V2 — Unified Specification

This document consolidates all Markdown files in the repository (`CLAUDE.md`, `STATUS.md`, `DESIGN.md`, `apps/api/CLAUDE.md`, and `apps/web/CLAUDE.md`) into a single unified reference.

---

## Table of Contents
1. [Root CLAUDE.md](#1-root-claudemd)
2. [STATUS.md (Project State & Roadmap Status)](#2-statusmd-project-state--roadmap-status)
3. [DESIGN.md (Foundations, Decisions & Architecture)](#3-designmd-foundations-decisions--architecture)
4. [apps/api/CLAUDE.md (Backend Blueprint)](#4-appsapiclaudemd-backend-blueprint)
5. [apps/web/CLAUDE.md (Frontend Blueprint)](#5-appswebclaudemd-frontend-blueprint)

---

## 1. Root CLAUDE.md

### What this is

A modular, cadence-paced learning platform for "Intellectual Explorers." A reader buys a book;
its chapters unlock on a schedule; each arrives by WhatsApp as a self-authenticating link; they
read it in a token-gated chamber and discuss it with a companion.

**V2 is the same product as V1, rebuilt so every piece is deliberate.** V1 lives at
`../Sapien Paradox App` and is **read-only reference**.

### Read first

| File | When |
|---|---|
| **`STATUS.md`** | always — current focus, next action, open questions |
| **`DESIGN.md`** | before proposing anything structural — product, architecture, all 14 decisions |
| `apps/api/CLAUDE.md` | working on the backend |
| `apps/web/CLAUDE.md` | working on the frontend |

Most structural questions are already decided in `DESIGN.md`, with rationale. Check before
proposing.

### Layout

```
apps/api/     Django 6 + Django Ninja + Postgres   → has its own CLAUDE.md
apps/web/     React (Vite) + TS + XState           → has its own CLAUDE.md
docs/         operational docs (setup, deploy)
DESIGN.md     what we're building and why
STATUS.md     what's happening now
```

Monorepo, one git history. **A vertical slice is one PR** spanning both apps — V1 split repos by
lane and every feature had to be split in half with manual cross-repo merge ordering.

Deployed as `app.<domain>` (static SPA) + `api.<domain>` (Django), session cookie scoped to the
parent domain. See D6.

### The three seams

Everything routes through these; nothing bypasses them. This is what makes payments and cadence
drop-ins later rather than second implementations.

- **`access.can_read(user_or_token, chapter)`** — the only access check. Never query `Order` or
  `TemporalGrant` directly.
- **`onboarding.create_reader(...)`** — the only way a reader comes into existence.
- **`whatsapp.send_chapter(grant)`** — the only delivery path.

*Anything a human can do in Django admin, a service function does.*

### Engineering mandates

1. **Zero hardcoded strings** — UI text via `labels.ts`; message templates and the companion
   prompt in their own config files, editable without touching logic.
2. **Machine-first logic** — complex UI state is an XState machine with the 5-file split.
3. **Temporal security** — never expose a storage URL; always proxy bytes through the API.
4. **Type-safe API** — Ninja schemas on every request/response body; no untyped dicts at the
   boundary, no `as any` on the frontend.
5. **Variable Velocity** — animations start fast, settle slow.
6. **Env-driven externals** — anything touching the outside world reads env and has a
   console/no-op fallback. A fresh clone runs with zero credentials.

### Working discipline

- **BFS** — root before leaves, exhaust a level before descending. One question at a time, always
  with a recommended answer.
- **Decisions land immediately** in `DESIGN.md`, not at end of turn. Sessions end abruptly.
- **Every departure from V1** carries an `Inherited from V1` block: what V1 did, what V2 does,
  why, what would make us revisit.
- **One canonical doc per question.** If a new doc would overlap an existing one, edit the
  existing one. V1 had three docs answering "what are we building" and they drifted apart.
- **Simple over fancy.** Complexity must earn its keep.

---

## 2. STATUS.md (Project State & Roadmap Status)

> Current focus and open questions. Changes every session.
> Decisions belong in `DESIGN.md`, not here. **This is not a diary** — V1's equivalent
> accumulated a 24-entry narrative log that nobody could use.

**Last updated:** 2026-08-08

### Where we are

**Planning, Level 1 complete.** Root and domain levels locked — D1–D14 in `DESIGN.md`. Level 3
detail (copy, validation, animation, prompt craft) is deferred by decision to the point each
feature is built.

No code written. Repo scaffolded, `git init`, **nothing committed yet**, no remote.

### Next action

**Phase −1 — start the clock on external dependencies.** Nothing there is engineering; it's all
lead time, and it blocks the WhatsApp demo.

1. Close the message-template copy (open question 1) — it gates Meta submission.
2. Apply for the Twilio WhatsApp sender; submit all three templates.
3. Register the domain; point `app.` and `api.` at hosts.
4. Anthropic API key; Stripe test account.

Phase 0 can start in parallel — the waiting is not a blocker for scaffolding.

### Open questions

| # | Question | Blocks | Default if unanswered |
|---|---|---|---|
| 1 | **Message template copy** (3 templates) | **Meta approval → Phase 4 demo** | I draft in `BUSINESS.md` register for review |
| 2 | Domain name | Phase −1 | — must be chosen |
| 3 | Hosts for `app.` and `api.` | Phase 0 | Cloudflare Pages / Render + managed Postgres + R2 |
| 4 | Companion interaction design + system prompt | Phase 5 | its own session (D14) |
| 5 | XState machine file location — V1 had two conventions | Phase 1 | `src/pages/<page>/machine/` |
| 6 | Read/unread mark on Home — keep or drop | Phase 2 | keep (D11) |
| 7 | Push to GitHub under `sapien-paradox-devs`? | when convenient | not pushed — your call |
| 8 | Commit the plan | now | uncommitted on disk |

### V1 is read-only reference

`../Sapien Paradox App` — consult for working code (Stripe service, auth endpoints, reading-room
machine, `labels.ts`) and for the `Inherited from V1` blocks in `DESIGN.md`. Nothing is carried
over without a decision recorded.

---

## 3. DESIGN.md (Foundations, Decisions & Architecture)

> What we're building, why, and every decision behind it. Changes when a decision lands.
> Current focus and open questions live in `STATUS.md`.
>
> **Convention:** anything that departs from V1 carries an **Inherited from V1** block — what V1
> did, what V2 does, why, and what would make us revisit. Nothing is silently dropped.

**Locked through Level 1** (2026-08-08). Level 3 detail — copy, validation, animation, prompt
craft — is deferred by decision to the point each feature is built.

### 3.1 The product

A modular, cadence-paced learning platform for "Intellectual Explorers." A reader buys a book;
its chapters unlock on a schedule; each arrives by WhatsApp as a self-authenticating link; they
read it in a token-gated chamber and discuss it with a companion. Depth over velocity, digital
monasticism, temporal delivery.

**Personas:** Reader (the whole product) · Admin (Django admin only, no custom UI yet).

### 3.2 Scope

**V2 is the same product as V1** (D1), rebuilt so every piece is deliberate. Not a smaller
product — payments and cadence are **sequenced later, not dropped**.

```
├── 0. Foundations   monorepo · deployed skeleton · labels · seed
├── 1. Login         email + password, session that survives refresh
├── 2. Home          account block + chapter list
├── 3. Reader        token-gated chamber + sanctuary
├── 4. WhatsApp      send a chapter link
└── 5. Companion     chapter-scoped discussion partner
```

These are the **first slices of the real product**.

#### Sequenced later — seams already in place

| Later | Plugs into |
|---|---|
| Payments (Stripe) | `onboarding.create_reader(...)` |
| Cadence | `TemporalGrant.unlock_at` + `access.can_read` |
| Reminders | `opened_at` + a pre-approved template |
| Subscriptions | `access.can_read` |
| Admin tooling | `core/services/*` |
| Public signup | replaced by concierge onboarding (D10) |

The one structural consequence of cadence arriving later: nothing computes a
future unlock time yet, so every chapter is available immediately. `unlock_at` exists and stays
null.

### 3.3 Foundational decisions

#### D1 — V2 is the same product as V1, rebuilt for control
The full thesis stands. **Consequence:** we keep the seams — `TemporalGrant` stays, access checks
route through one service function, WhatsApp sends stay grant-based. Cadence later means "write
`cadence.py`, set `unlock_at`" with no rewiring.

**Why not a simpler session-only design:** WhatsApp links must self-authenticate. A link that
dead-ends on a login screen is a bad demo and a worse product. That is the entire reason
`TemporalGrant` exists.

#### D2 — Deep detail only for what we're building; a shallow spine for everything else
Future domains get one paragraph each (§4.4) naming their seam and the constraint they impose
today — no screens, no field lists.

**Why:** V1 produced `OVERVIEW.md`, `DETAILED_SPEC.md`, and `REBUILD.md` — three overlapping
"what we're building" docs written the same day, each drifting. The planning wasn't too thin, it
was too broad and unanchored to anything being built.

#### D3 — Same engineering conventions as V1
Listed in §6. **Open:** V1 placed XState machines in two locations (`src/machines/login/` *and*
`src/pages/reading-room/machine/`); pick one, proposed `src/pages/<page>/machine/`.

Low-level conventions are decided when we dig into each feature, not up front.

#### D4 — Domain model: four departures from V1

- **`Shard` entity**
  - **V1 did:** `Chapter.shard = OneToOneField(Shard)`; `Shard` held title, slug, file.
  - **V2 does:** the file lives on `Chapter`. No `Shard` table. "Shard" survives as product
    vocabulary in the UI, not as a table.
  - **Why:** strictly 1:1 — the join bought nothing.
  - **Revisit if:** a PDF is shared across books, or a chapter needs multiple files.
  - **Follow V1?** ☐ yes ☑ no

- **View quota**
  - **V1 did:** `max_views = 5` / `current_views`, enforced in `is_valid()`.
  - **V2 does:** removed.
  - **Why:** appears in no V1 plan document — it arrived in code and was never specced. As written,
    a reader who opens a chapter six times is locked out of a book they paid for. Time-bounded
    access is the product concept; view-counting is a harsher one nobody chose.
  - **Revisit if:** we need anti-sharing enforcement on grant links.
  - **Follow V1?** ☐ yes ☑ no

- **`pace` location**
  - **V2 does:** unchanged — stays on `Order`.
  - **Why:** a reader may read one book at Crawl and another at Soar, and it keeps the cadence
    anchor (`Order.created_at` + pace) in one row.
  - **Follow V1?** ☑ yes

- **`TemporalGrant.user` nullability**
  - **V1 did:** nullable — a leftover from the pre-auth era of anonymous grants.
  - **V2 does:** required.
  - **Why:** every grant belongs to someone. Nullable FKs breed `if grant.user:` branches forever.
  - **Follow V1?** ☐ yes ☑ no

**New in V2:** `MessageLog` (without it delivery is undebuggable) and `Chapter.text_content`
(the companion cannot be grounded without it).

#### D5 — Deploy-first, with real external dependencies from Phase 0
Real managed Postgres, real object storage, real credentials — provisioned and deployed before
there is much to deploy. Deployment is not a separate project at the end.

**Consequences:** DB from `DATABASE_URL` (`dj-database-url`) at first commit · files through
Django's storage backend (`django-storages`), chosen by env · every integration reads env and has
a console/no-op fallback, so a fresh clone runs with zero credentials.

**Lead-time item — Twilio WhatsApp is the long pole.** The sandbox works instantly but every
recipient must text a join code first. Production sending needs a WhatsApp Business Sender: Meta
Business account, business verification, and an approved template before you may message a user
who hasn't messaged you first. Days-to-weeks of waiting. **Start first.** Anthropic is an instant
key; Stripe test mode is instant.

#### D6 — Split origin under one parent domain
`app.<domain>` (static SPA) + `api.<domain>` (Django), session cookie scoped to `.<domain>`.

**Why:** unrelated domains (`…vercel.app` → `…onrender.com`) make the session cookie a
third-party cookie needing `SameSite=None; Secure` — which Safari ITP and most blockers drop, so
login silently fails on some devices. V1 never hit this because both sides ran on `localhost`.

**Also:** WhatsApp links carrying a real domain matter for a product selling restraint and craft.

**Rejected:** single-origin (Django serves the SPA) — simpler and defensible, but couples deploys.
Split-on-vendor-domains — ruled out for the cookie reason.

### 3.4 Architecture

#### 3.4.1 System shape

```
                    ┌──────────────────────────┐
                    │       Web Browser        │
                    │                          │
                    └──────┬────────────┬──────┘
                           │            │
                           │            │
                           │            │
                    ┌──────▼─────┐ ┌────▼──────┐
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

**Strict layering.** `core/api/*` — HTTP only, Ninja schemas in and out, no business logic.
`core/services/*` — all business logic, callable from API, admin, CLI, and later webhooks and
schedulers. `core/models.py` — data only.

#### 3.4.2 Data model

```
User ──< Order >── Book ──< Chapter ──< TemporalGrant >── User
                                 │
                            (PDF file, text_content)
MessageLog >── User, Chapter
```

| Entity | Carries |
|---|---|
| `User` | email (login), password, full_name, phone, role |
| `Book` | title, slug, price_cents |
| `Chapter` | book, order_index, title, PDF file, `text_content` |
| `Order` | user, book, **pace**, created_at (the cadence anchor) |
| `TemporalGrant` | user (required), chapter, token, `unlock_at` (null for now), `expires_at` (+7d), `opened_at` |
| `MessageLog` | user, chapter, template key, provider message id, status, error, sent_at |

#### 3.4.3 The seams

Three functions everything routes through. Future domains attach here and nowhere else.

**`access.can_read(user_or_token, chapter) -> bool`** — the only access check. Today: does an
`Order` exist, and is the grant unlocked and unexpired? Cadence adds an `unlock_at` comparison;
subscriptions add an alternative path. **No caller queries `Order` or `TemporalGrant` directly.**

**`onboarding.create_reader(name, email, phone, book, pace)`** — the only way a reader comes into
existence. Creates User + Order + first grant atomically, then sends chapter 1 post-commit.
Called by Django admin and `seed_dev` today; by the Stripe webhook later.

**`whatsapp.send_chapter(grant)`** — the only delivery path. Called by onboarding, admin, CLI and
sanctuary re-issue today; by the cadence scheduler later.

*Anything a human can do in Django admin, a service function does.* That rule is what makes
payments and cadence drop-ins rather than second implementations.

#### 3.4.4 Future domains

**Payments (Stripe).** Checkout from the landing form; webhook calls
`onboarding.create_reader(...)` in a transaction, delivery post-commit. **Constraint today:**
onboarding stays a single service function with no `request` dependency, and `Order` must be
creatable without an authenticated session — at webhook time there is no logged-in user.
Idempotency on the Stripe event id will be needed; nothing today blocks it.

**Cadence.** A scheduled job walking open orders, minting a grant for any chapter whose unlock
time has arrived (`Order.created_at + (N-1) × pace_delay`) and calling `whatsapp.send_chapter`.
**Constraint today:** `unlock_at` must exist and be nullable (it does), `access.can_read` must be
the only access check, and `pace` must stay on `Order`. Unlocks are schedule-driven, never
read-completion-driven — do not couple anything to `opened_at`. Mechanism (cron / management
command / Celery beat) deliberately unchosen; pick the simplest that demos.

**Reminders.** One WhatsApp nudge per chapter ~24h after unlock if `opened_at` is null.
**Constraint:** `opened_at` stamped on first open (it is), and the template pre-approved — which
is why it ships in the first submission batch (D12).

**Subscriptions.** **Constraint:** `access.can_read` must be able to answer "yes" via a path that
isn't an `Order` row. Additive as long as every caller goes through it.

**Catalog / multi-book.** Already handled — `Order` is per-book and Home groups by book (D11).

**Admin tooling.** **Constraint:** none, provided operations stay in `core/services/*` rather than
accumulating inside Django admin classes.

**Streaming chat.** **Constraint:** keep the chat request/response shape stable and the transport
swappable; don't leak transport into the machine's state graph.

### 3.5 The features

#### 3.5.0 Foundations

Monorepo, both apps deployed, label systems, seed data, env config.

**Critical path:** the lead-time items in Phase −1 — Twilio sender application, three Meta
template submissions, domain registration. None are engineering; all block the Phase 4 demo.

**Open at build time:** hosts for `app.`/`api.` (suggested Cloudflare Pages / Render + managed
Postgres + R2) · domain name · CI shape beyond path filters · CSS token set.

#### 3.5.1 Login

Email + password against a Django session. One screen, `/login`. No public signup.

**Endpoints:** `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me`

##### D7 — Auth surface map

| Surface | Auth |
|---|---|
| `/login`, `POST /api/auth/login` | public |
| `/`, `GET /api/home` | session |
| `/read/:chapterId` | session (mints-or-reuses, then redirects) |
| `/r/:token`, `GET /api/grants/:token` | token only |
| `GET /api/shards/stream/?token=` | token only |
| `POST /api/chat` | token only |

**The consequence we accepted:** `/api/chat` is unauthenticated *and* spends money per call.
Grant links travel over WhatsApp, get forwarded, and persist in chat history. It is the only
endpoint with an uncapped per-request cost. **Therefore, built in Phase 5 rather than bolted on:**
per-grant daily cap, global daily ceiling as a kill switch, max input length, per-grant logging.

**Rejected:** requiring a session for chat — it deletes the feature on phones, where it's most
useful, and undercuts the reason tokens exist.

##### D10 — Readers are created by concierge onboarding

Django admin creates the reader and their `Order`; the system mints grants and sends chapter 1.
`seed_dev` does the same locally. **No public signup** until payments land. Both paths call
`onboarding.create_reader(...)` — one code path, so Stripe later is a webhook calling it.

**Rejected:** a public no-payment signup page — builds a screen that gets reworked once payment
gates it, and gives the product away meanwhile.

**Carried forward deliberately:** V1 shipped without session persistence and filed it as a future
note. V2 does it up front — `GET /api/auth/me` on boot rehydrates.

**Most likely to break quietly:** the cross-subdomain cookie (D6). Test on Safari — ITP kills
this, and localhost never reveals it.

**Open at build time:** XState machine location · password reset (needed at all, given concierge
onboarding?) · session lifetime · error copy.

#### 3.5.2 Home

The signed-in surface at `/`. Account block (name, email, phone, book, logout) plus chapters.

**Endpoint:** `GET /api/home` — user summary + books + chapters. **No tokens in the payload.**

##### D11 — Home links are session-gated and mint on demand

Chapters link to `/read/:chapterId`, which requires the session, finds a live grant or mints a
fresh one, then redirects to `/r/:token`.

**Why:** with 7-day expiry (D8), returning stored tokens would make Home a list of mostly-dead
links — absurd for the one surface that must always work. Resolving at click time makes Home
structurally incapable of showing a broken link, and keeps tokens out of the JSON.

**Display:** number, title, and a quiet read/unread mark from `opened_at`. Flat for one book,
grouped for several. No progress bars, percentages, or badges — they fight the product's restraint.

**Open at build time:** empty state (reader with no book) · whether the read/unread mark survives
design review · ordering across several books.

#### 3.5.3 Reader

The token-gated chamber at `/r/:token`. One chapter via `react-pdf`, streamed through the API.

**Endpoints:** `GET /api/grants/:token` (validate, return chapter meta, stamp `opened_at`) ·
`GET /api/shards/stream/?token=` (proxied bytes — never a storage URL)

**States:** loading → reading · invalid/expired → sanctuary · network error

##### D8 — Grants expire after 7 days

- **V1 did:** `expires_at` existed but nothing computed a meaningful value; links were eternal by
  accident.
- **V2 does:** 7 days.
- **Why:** matches the product's temporal vocabulary and bounds forwarded-link access. Aligns with
  cadence later — a chapter's link stays live roughly until the next arrives.
- **Revisit if:** readers hit sanctuary often enough to feel punished. Loosening is one field.
- **Follow V1?** ☐ yes ☑ no

**Consequence: sanctuary is a frequent state, not an edge case.** It must be good.

##### D9 — Expired links recover in one tap

Sanctuary shows "this link has rested" and a single **"Send me a fresh link"** button. No input,
no login — the expired grant still identifies its owner, so we mint a new one and send it to the
phone on the account.

**Safety:** the new link goes to the *owner's* phone, never the tapper's — a forwarded expired
link leaks no access. Rate limited to one re-issue per grant per hour.

**Accepted consequence:** WhatsApp becomes load-bearing for *recovery*, not just delivery. If
Twilio is down, expired-link recovery is down; Home login remains the fallback.

**Rejected:** asking for identity (we already know it) · requiring login (a password prompt on a
device that has never had one, on the most common failure path).

**Design intent** (from V1's `BUSINESS.md`, still binding): Apple-clean, not fancy. Uninterrupted
— no timers, no progress bars, no session metadata, no nudges. Auto-fading chrome. Threshold
ceremony on first entry per token. Soft expiry, no shouting.

**V1 reference:** three competing implementations exist there (`ShardView`, `ReadingRoomView`,
`pages/reading-room/`). Only the last is real. Carry nothing over without a decision.

**Open at build time:** page controls · threshold ceremony timing · sanctuary copy · mobile layout.

#### 3.5.4 WhatsApp

Delivery of chapter links via Twilio. **Longest lead time in the project.**

##### D12 — Templates live in their own config file

Mirrors the `labels.ts` mandate: copy editable without touching send logic. Each entry carries its
internal key, the Meta/Twilio template identifier, its variable order, and a plain-text rendering
for console dev mode.

**Why this is urgent, not cosmetic:** WhatsApp forbids free-form business-initiated messages
outside a 24-hour window. Every template needs Meta pre-approval — fixed wording, numbered
variables, days of review, resubmission on rejection. **Copy is a Phase 0 deliverable.**

**Submit all three immediately**, including the cadence-era reminder — an approved unused template
costs nothing and keeps cadence off Meta's critical path later:
1. Chapter delivery 2. Fresh link (D9) 3. Unread reminder

**Triggers, all through one `whatsapp.send_chapter(grant)`:**

| Trigger | Sends |
|---|---|
| `onboarding.create_reader(...)` | chapter 1, automatically |
| Django admin action | that chapter, to that reader |
| `manage.py send_chapter --email --chapter` | same, from the CLI |
| Sanctuary re-issue | a re-minted grant (rate-limited) |

Cadence adds a fifth and reuses the same service.

**Dev fallback:** no credentials → prints to console. Local work and CI never touch the network.

**`MessageLog`** records every send — without it delivery is undebuggable.

**Open at build time — one item gates everything:** **template copy** (deferred until the overall
picture is clear; **blocks Meta submission → Phase 4 demo** — close early) · sandbox vs. approved
sender for the first real test · retry policy · whether `MessageLog` needs Twilio status webhooks.

#### 3.5.5 Companion

A chapter-scoped discussion partner. Not a Q&A utility — one that **asks you** questions and
follows your thinking.

##### D13 — Chapter-scoped, exploratory not evaluative

**No scores, no right answers, no testing.** This distinction is load-bearing: "asks you questions
about the chapter" drifts into quizzing very easily, and quizzing is the gamification layer V1
explicitly deferred.

**Scope:** the currently open chapter only. Not other chapters, not the rest of the book, not the
account. Off-topic requests declined and redirected.

**Rejected — book-wide tutor:** needs cross-chapter retrieval, can spoil chapters you haven't
reached (a real product violation once cadence returns), and is the deferred quiz feature wearing
a smaller feature's clothes.

**Technical shape** (deliberately cheap): whole chapter's `text_content` in the system prompt — no
retrieval, no chunking, no embeddings. History browser-side for the sitting, nothing persisted.
Claude Sonnet 5 (`claude-sonnet-5`). Non-streaming to start. Cost control per D7.

**Prerequisite that will block this phase if forgotten:** `Chapter.text_content`, extracted with
`pypdf` at upload/seed time.

##### D14 — The companion never interrupts

`BUSINESS.md` locks the chamber as uninterrupted — "no timers, no progress bars, no session
metadata, no nudges." A companion that speaks first is structurally a nudge.

**Locked:** the panel sits closed and silent while you read. When *you* open it, the companion
speaks first — with a question about the chapter, not a greeting. Opening the panel is you leaving
the room voluntarily, so the room stays uninterrupted.

**Leading candidate to revisit:** also offering a question at the *end* of a chapter — the same
mechanic at the natural pause, turning "finished the chapter" into a conversation.

**Rejected — ambient prompting** (noticing you've lingered and surfacing a question): exactly the
scroll-culture interruption the product sells relief from.

**Inherited from V1 — the Oracle panel**
- **V1 did:** a floating chatbot added in two unticketed commits straight to main, never planned,
  never wired to a backend.
- **V2 does:** a planned, grounded, bounded companion. V1's UI is visual reference only.
- **Follow V1?** ☐ yes ☑ no

**Open — its own design session:** the interaction model in full · **the system prompt**, a
versioned deliverable with real iteration in its own file (the difference between a good and bad
companion here is almost entirely prompt craft) · every chapter at once or one first · streaming.

### 3.6 Conventions

1. **Zero hardcoded strings** — all UI text via `labels.ts` / `locale.ts`. Message templates and
   the companion prompt live in their own config files, editable without touching logic.
2. **Machine-first logic** — XState with the 5-file split for complex UI state.
3. **Temporal security** — never expose a storage URL; always proxy. Also what keeps object
   storage swappable, since nothing outside the backend knows where files live.
4. **Type-safe API** — Ninja schemas on every request/response body; no untyped dicts at the
   boundary, no `as any` on the frontend.
5. **Variable Velocity** — animations start fast, settle slow.
6. **Env-driven externals** — anything touching the outside world reads env and has a console/no-op
   fallback.

### 3.7 Roadmap

Each phase is an independently demoable vertical slice, **deployed** (D5). A phase is done when
its Demo line is true on the deployed instance, not just locally.

**Phase −1 — Start the clock.** Do before any code; it's all waiting, and the waiting is the
critical path. Twilio sender application · submit three Meta templates · register domain + DNS for
`app.`/`api.` · Anthropic key · Stripe test account.
*Done when applications are in and the domain resolves. Phase 0 proceeds in parallel.*

**Phase 0 — Deployed foundations.** Monorepo, Django + Ninja, `DATABASE_URL`, `django-storages`,
Vite + React + Router + XState, `labels.ts`, env config with console fallbacks, path-filtered CI,
**both sides deployed** with managed Postgres and real object storage.
*Demo: `api.<domain>/api/health` 200 in production; `app.<domain>` renders from `labels.ts`; fresh
clone runs locally with zero credentials.*

**Phase 1 — Login.** Auth endpoints, `/login` + machine, protected-route redirect, boot-time
rehydration, cookie scoped to the parent domain, CORS/CSRF from env, `seed_dev` reader.
*Demo: log in on the deployed app, refresh, new tab, still logged in — **on Safari**. Log out,
bounced.*

**Phase 2 — Content model + Home.** Models + migrations, `access.can_read`,
`onboarding.create_reader`, `GET /api/home`, `/read/:chapterId`, Home screen, Django admin
onboarding, `seed_dev` with PDFs in object storage.
*Demo: create a reader through admin on the deployed instance; log in as them; see the chapters.*

**Phase 3 — Reader.** Grants + stream endpoints, `/r/:token` with `react-pdf` + machine, sanctuary,
7-day expiry.
*Demo: read from Home; same URL in a logged-out private window still works; hand-expire a grant and
get sanctuary, not a stack trace.*

**Phase 4 — WhatsApp.** Twilio + console backends, `MessageLog`, admin action, `send_chapter` CLI,
sanctuary re-issue endpoint.
*Demo: a real message on a real phone with a working link; tapping it opens the chapter with no
login; let a grant expire and recover it in one tap; with credentials removed everything prints to
console.*
*Blocked on Phase −1 clearing — build against console and switch when approval lands.*

**Phase 5 — Companion.** `text_content` extraction, `POST /api/chat`, caps and logging,
collapsible panel, versioned prompt file. *Precondition: its own design session (D14).*
*Demo: open the panel and it opens with a question; it follows the thread across turns; off-topic
declines gracefully; exceeding the cap degrades politely.*

**Phase 6 — Slice closer.** End-to-end test onboard → login → home → read → discuss; complete seed;
`docs/HOW_TO_START.md`.
*Demo: fresh clone → one seed command → whole flow works locally and on the deployed instance.*

```
−1 ──▶ 0 ──▶ 1 ──▶ 2 ──┬──▶ 3 ──▶ 5 ──┐
   (waiting runs        │              ├──▶ 6
    in parallel)        └──▶ 4 ────────┘
```

---

## 4. apps/api/CLAUDE.md (Backend Blueprint)

Django 6 + Django Ninja + Postgres. Serves `api.<domain>`.

Root context: `../../CLAUDE.md`. Design and decisions: `../../DESIGN.md`.

### Layering — strict

| Layer | Holds | Never |
|---|---|---|
| `core/api/*` | HTTP only. Ninja schemas in and out. | business logic |
| `core/services/*` | all business logic | HTTP concerns, `request` objects |
| `core/models.py` | data | orchestration |

Services must be callable from the API, Django admin, management commands, and later from
webhooks and schedulers. If a service needs `request`, it's in the wrong layer — that's what makes
the Stripe webhook a drop-in later (D10).

### The three seams

- `access.can_read(user_or_token, chapter)` — the only access check. **No caller queries `Order`
  or `TemporalGrant` directly.** Cadence and subscriptions extend this function; they don't add
  parallel checks.
- `onboarding.create_reader(name, email, phone, book, pace)` — the only way a reader comes into
  existence. User + Order + first grant atomically, delivery post-commit.
- `whatsapp.send_chapter(grant)` — the only delivery path.

### Data model

```
User ──< Order >── Book ──< Chapter ──< TemporalGrant >── User
                                 │
                            (PDF file, text_content)
MessageLog >── User, Chapter
```

Departures from V1 (no `Shard` table, no view quota, `grant.user` required) and their rationale:
`DESIGN.md` D4. Don't reintroduce them without updating that block.

### Mandates

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

### Commands

```bash
python3 manage.py runserver          # :8000
python3 manage.py makemigrations core && python3 manage.py migrate
python3 manage.py test core
python3 manage.py seed_dev           # idempotent
python3 manage.py send_chapter --email=… --chapter=1
```

### Pitfalls from V1

- **Callable defaults on model fields.** V1 lost a full ticket to `shortuuid.uuid` vs.
  `ShortUUID.uuid` — an unbound method as a field default broke every insert at runtime, and
  Django's autodetector then looped proposing the same migration forever. Use a module-level
  wrapper function so the migration records a stable import path.
- **Run `makemigrations --check` before every PR.** Migration drift on master blocked several
  tickets in V1.
- **Don't let logic accumulate in `admin.py`.** Admin actions call services (D10) — that's what
  makes payments additive later.

---

## 5. apps/web/CLAUDE.md (Frontend Blueprint)

React + Vite + TypeScript, XState v5, Framer Motion, vanilla CSS. Serves `app.<domain>`.

Root context: `../../CLAUDE.md`. Design and decisions: `../../DESIGN.md`.

### Routes

| Route | Auth | Notes |
|---|---|---|
| `/login` | public | email + password |
| `/` | session | Home — account block + chapters |
| `/read/:chapterId` | session | mints-or-reuses a grant, then redirects (D11) |
| `/r/:token` | **token only** | the chamber. **No session required** — this is what makes WhatsApp links work |

Full surface map: `DESIGN.md` D7.

### Mandates

1. **Zero hardcoded strings.** Every piece of UI text goes through `src/lib/labels.ts` and is read
   via `locale.ts`. No exceptions — V1's login PR was blocked in review for a single hardcoded
   `"Welcome back,"`.
2. **Machine-first logic.** Complex UI state is an XState machine with the 5-file split:
   `machine.ts`, `actions.ts`, `guards.ts`, `actors.ts`, `index.ts`. Not scattered `useState`.
3. **No `as any`.** V1's first frontend PR was blocked for `as any` casts across eight files and
   for weakening `locale()`'s return type to `any`. The API is typed on the backend; keep it typed
   here.
4. **Variable Velocity.** Animations start fast, settle slow.

### XState conventions

- **Location:** `src/pages/<page>/machine/`. *V1 had two competing conventions
  (`src/machines/login/` and `src/pages/reading-room/machine/`) — pick this one and hold it.*
  Still formally open, see `STATUS.md` #5.
- Simple TypeScript — no `satisfies`, no generics gymnastics.
- Guards as named exports; actions and actors as objects.

### API calls

All requests need `credentials: "include"` — the session cookie is scoped to the parent domain
(D6). Never hardcode a host; use the configured API base. *V1 shipped hardcoded `localhost` URLs
to review twice.*

### Design intent

From `BUSINESS.md`, still binding for the chamber: **Apple-clean, not fancy. Uninterrupted** — no
timers, no progress bars, no session metadata, no nudges. Auto-fading chrome. Soft expiry, no
shouting.

This is why the companion panel sits silent until *you* open it (D14), and why Home shows a quiet
read/unread mark rather than progress bars (D11).

### Pitfalls from V1

- **Three competing Reading Room implementations** existed simultaneously (`ShardView`,
  `ReadingRoomView`, `pages/reading-room/`). Before building a screen, check nothing already does
  it. Delete what you replace.
- **Unplanned features landing on main.** The Oracle chatbot arrived in two unticketed commits.
  Features get designed first — see `DESIGN.md`.
- **Session persistence.** V1 shipped login without it and filed it as a future note. Rehydrate
  from `GET /api/auth/me` on boot.
# Process and conventions

D2 · D3

---

## D2 — Deep specs for active work, a shallow spine for the rest

**Locked** 2026-08-08

Full detail only for domains in active scope. Every *future* domain gets one short entry in
`DESIGN.md` §4.4 naming the seam it plugs into and the constraint it imposes on today's code —
one paragraph, no screens, no field lists.

**Why:** V1 produced `OVERVIEW.md`, `DETAILED_SPEC.md`, and `REBUILD.md` — three overlapping
"what we're building" docs written the same day, each drifting from the others. The planning was
not too thin; it was too broad and unanchored to anything being built.

**Rejected:** designing the full product up front (specs written today go stale before anyone
reads them — exactly how V1 got three competing documents) · pure lazy planning (design the reader
without knowing cadence's needs and you wall yourself in).

**Standing rule: one canonical document per question.** If a new doc would overlap an existing
one, edit the existing one. This is why decisions live in `decisions/` and not also in
`DESIGN.md`.

---

## D3 — Same engineering conventions as V1

**Locked** 2026-08-08

Carried forward unchanged: XState for complex UI state with the 5-file split · zero hardcoded
strings via `labels.ts` / `locale.ts` · temporal security (never expose a storage URL) · type-safe
API (Ninja schemas on every body) · Variable Velocity animations.

Low-level conventions are decided when we dig into each feature, not up front.

**XState is the exception — specified now**, in `apps/web/CLAUDE.md`, because V1's convention
contained a contradiction that produced real review failures.

**Inherited from V1 — machine location**
- **V1 did:** ran two conventions simultaneously — `src/machines/<name>/` *and*
  `src/pages/<page>/machine/`.
- **V2 does:** `src/pages/<page>/machine/` only. Never more than six files; V1's landing machine
  grew to seven (`fields.ts`, `services.ts`), which signals a machine doing too much.
- **Follow V1?** ☐ yes ☑ no

**Inherited from V1 — typed context and events (`types.ts`)**
- **V1 did:** "context as a plain object literal, no type annotations" — so every event access was
  untyped and required a cast: `(event as any).token as string`,
  `({ event }: { event: any })`, `assign(({ context }: any) => …)`.
- **V2 does:** adds `types.ts` per machine (`Context` + `Event` union), fed to
  `createMachine({ types: {} as { context: Context; events: Event } })`.
- **Why:** V1's convention *required* the casts that V1's own mandate forbade — the two rules
  contradicted each other, and PR #6 was blocked for `as any` across eight files as a direct
  result. Still simple TS: two type aliases, no `satisfies`, no generics.
- **Follow V1?** ☐ yes ☑ no

**Related Phase 0 item:** build `apps/web/src/lib/fetcher.ts`. V1's skill mandated actors call
`mappedFetcher`, but **it was never built** — so every actor hand-rolled `fetch` plus a duplicated
error class, and hardcoded `localhost` URLs reached review twice. It owns the API base URL,
`credentials: "include"` (required by D6 and easy to forget per call), and one error shape carrying
`status`.

**`locale()` retained** from V1, but typed to return `string`. V1 weakened it to `any` and the PR
was blocked for it.

**Naming:** `sanctuary` means the expired/invalid link state (D8/D9). V1's reading-room machine
reused the word for end-of-chapter — that state is `finished`.
# Why V2 exists

The audit of V1 that every other decision traces back to. Read this first — without it, the
decisions in this folder look like taste.

**Audited:** 2026-08-08, against `../Sapien Paradox App` at commit `035b807` (Services) and
`eb2c141` (UI).

**The headline:** V1's planning was not bad. Its *containment* failed. Good decisions were made
and then leaked, duplicated, and drifted until nobody could tell which copy was true.

---

## 1. Repo topology was the root cause

The project root was **not a git repository**. `backend/` and `frontend/` were two independent
repos (`Sapien-Paradox-App-Services`, `Sapien-Paradox-App-UI`).

**Consequences, all observed:**

- `plans/`, `CLAUDE.md`, `.claude/`, and `skills-lock.json` existed in **three** places — root,
  backend, frontend — and diverged.
- **The root `plans/` tree was tracked by no repository at all.** The most valuable artifact in
  the project had no history, no backup, and no review.
- Every feature split in half by lane. `T011` (Reading Room) became `T011a` (Services PR #10) and
  `T011b` (UI PR #8) with a hand-maintained "merge after T011a" ordering constraint.
- Cross-repo status drifted and stayed drifted: `STATE.md` recorded T009 / T011a / T011b as merged
  on GitHub but still `in-review` in `EXECUTION.md`, across multiple sessions.

→ **D6** (monorepo), **D20** (shared constants — impossible with two repos)

---

## 2. Plans stratified into competing truths

Three overlapping "what we're building" documents — `OVERVIEW.md`, `DETAILED_SPEC.md` (329 lines),
and `REBUILD.md` — were **all created on the same day**, on top of `STATE.md` and a four-file
`_archive/`. Each drifted from the others.

`STATE.md` itself became a **24-entry running narrative** ("Recent thread") that no one could use
to answer a question.

`components/` covered 2 of roughly 8 domains.

→ **D2** (one canonical doc per question), the `decisions/` folder itself, and `STATUS.md`'s
explicit "this is not a diary" rule.

---

## 3. The product's central mechanic was never built

Backend was ~1,405 LOC with auth, models, Stripe checkout, and grants — genuinely working, 27
tests passing.

**`cadence.py` did not exist.** The scheduled-unlock mechanic — the entire product thesis — was
never written. `whatsapp.py` was a stub. Tickets T004 (cadence) and T005 (Twilio) sat `queued`
while payments were polished.

→ **D1** (V2 is the same product; the thesis is not optional), and the roadmap ordering that puts
delivery before payments.

---

## 4. Duplicates accumulated because nothing deleted

Frontend was ~4,413 LOC containing **three** Reading Room implementations simultaneously:
`ShardView` (legacy overlay), `ReadingRoomView` (mock feed), and `pages/reading-room/` (real). A
mock-auth `AppShell` sat beside real auth. `STATE.md` acknowledged this as an open question rather
than fixing it.

→ `apps/web/CLAUDE.md`'s "before building a screen, check nothing already does it; delete what you
replace."

---

## 5. Unplanned features landed on main

The Oracle chatbot arrived in **two unticketed commits straight to main** (`4b8f52b`, `eb2c141`),
never planned, never wired to a backend. It then had to be retro-fitted into the tracker as T014.

→ **D13** (the companion is designed before it is built, with a locked boundary).

---

## 6. Conventions enforced by prose got violated

The mandates lived in `CLAUDE.md` as English. PR #6 was blocked in review for `as any` across
**eight** files, a hardcoded `"Welcome back,"`, a `loginMachine` violating the mandated 5-file
split, and `locale()`'s return type weakened to `any`.

**The deeper problem: two mandates contradicted each other.** The XState convention said "context
as a plain object literal, no type annotations," which makes every event access untyped and
*forces* casts — while a separate mandate banned `as any`. The `as any` spam was the convention
working as written.

→ **D3** (`types.ts` per machine, resolving the contradiction), and stating the rule with a
decidable threshold rather than the undefined word "complex."

---

## 7. Documentation described code that did not exist

`frontend/CLAUDE.md` lists `src/lib/fetcher.ts` — `mappedFetcher` — in its architecture map, and
the `create-machine` skill instructs every actor to call it.

**It was never written.** `src/lib/` contains only `labels.ts` and `locale.ts`; grep finds zero
references anywhere in the codebase. So every actor hand-rolled `fetch` plus its own duplicated
error class (`LoginError`, `GrantFetchError`), and hardcoded `localhost` URLs reached review twice
because there was no central place for a base URL.

→ `apps/web/CLAUDE.md` specifies `fetcher.ts` as a **Phase 0 deliverable**, not an assumption.
And a general lesson: **an architecture map that is not checked becomes fiction.**

---

## 8. Small traps that cost real time

- **`shortuuid.uuid` as a model field default** cost an entire ticket (T015). It is a *bound
  method* on a module singleton: using it directly broke every insert at runtime, and the fix
  attempt sent Django's autodetector into an infinite migration loop. Resolved with a module-level
  wrapper. → recorded in **D21** and `apps/api/CLAUDE.md`.
- **Migration drift on master** blocked several tickets. → `makemigrations --check` before every
  PR.
- **A view quota** (`max_views = 5`) appeared in code, in no plan, and would have locked a paying
  reader out on their sixth open. → **D4** deleted it.

---

## What V2 does differently

| V1 failure | V2 answer |
|---|---|
| Two repos, plans tracked nowhere | Monorepo; one history (**D6**) |
| Three docs answering one question | One canonical doc per question (**D2**); decisions only in `decisions/` |
| STATE.md as a 24-entry diary | `STATUS.md` holds open questions only |
| Central mechanic unbuilt | Delivery before payments (roadmap) |
| Three Reading Rooms | Delete what you replace |
| Unticketed features on main | Designed first (**D13**) |
| Contradictory conventions | **D3** resolves the contradiction |
| Docs describing absent code | `fetcher.ts` is a Phase 0 deliverable |
| Decisions lost to archaeology | `Inherited from V1` blocks on every departure |
# Infrastructure

D5 · D6 · D16 · D17 · D20

---

## D5 — Deploy-first, with real external dependencies from Phase 0

**Locked** 2026-08-08

Real managed Postgres, real object storage, real credentials — provisioned and deployed before
there is much to deploy. Deployment is not a separate project at the end.

**Consequences:** DB read from `DATABASE_URL` (`dj-database-url`) at first commit · files through
Django's storage backend (`django-storages`), backend chosen by env · every integration reads env
and has a console/no-op fallback, so a fresh clone runs with zero credentials.

**Rejected:** local-first with the host deferred (my original recommendation; overruled). The
overrule was correct — retrofitting object storage after content exists means a data migration.

**Lead-time item — Twilio WhatsApp is the long pole.** The sandbox works instantly but every
recipient must text a join code first. Production sending needs a WhatsApp Business Sender: Meta
Business account, business verification, and approved templates before you may message a user who
has not messaged you first. Days-to-weeks of waiting. **Start first.** Anthropic is an instant
key; Stripe test mode is instant.

---

## D6 — Split origin under one parent domain

**Locked** 2026-08-08

`app.<domain>` (static SPA) + `api.<domain>` (Django), session cookie scoped to `.<domain>`.

**Why:** unrelated domains (`…vercel.app` → `…onrender.com`) make the session cookie a
third-party cookie needing `SameSite=None; Secure` — which Safari ITP and most blockers drop, so
login silently fails on some devices. V1 never hit this because both sides ran on `localhost`.

**Also:** WhatsApp links carrying a real domain matter for a product selling restraint and craft.

**Rejected:** single-origin, Django serving the SPA (simpler and genuinely defensible, but couples
deploys) · split hosts on vendor domains (the third-party-cookie problem above).

**Phase 0 tasks this creates:** register the domain · DNS for both subdomains · CORS allowlist,
`CSRF_TRUSTED_ORIGINS`, and `SESSION_COOKIE_DOMAIN` configured from env.

**Repo topology:** a single monorepo, decided alongside this. A vertical slice is one PR spanning
both apps; V1 split repos by lane, so every feature was split in half with manual cross-repo merge
ordering (T011 → T011a + T011b), and `plans/` lived in no repo at all. The one real cost is that
GitHub grants access per repo, so there is no per-directory access control.

---

## D16 — Five external systems. No email provider.

**Locked** 2026-08-09

| System | Owns | If it's down |
|---|---|---|
| Postgres (managed) | all application data | app is down |
| Object storage (R2/S3) | PDF files | reading fails; rest works |
| Twilio | WhatsApp delivery, expired-link recovery, **password reset** | no new links; existing ones keep working |
| Anthropic | the companion | chat unavailable; reading unaffected |
| Stripe | payments — later (D10) | — |

**No email provider anywhere.** WhatsApp is the only outbound channel. Password reset sends a link
over WhatsApp: every reader has a verified phone (D19 makes it unique), the delivery service
already exists, and it needs one more Meta template — **a fourth, submitted in the same Phase −1
batch** while the waiting is free.

**Rejected — a transactional email provider** (Postmark/Resend/SES): adds a vendor, credentials, a
sender domain with SPF/DKIM, and its own template, to duplicate a channel we already have. Its one
real advantage is independence from Twilio.

**Rejected — no self-serve reset at all:** honest at ten readers, embarrassing at a hundred. Used
as the interim until templates clear.

**Accepted consequence:** Twilio becomes the only self-serve way back into an account. If Meta
rejects the templates or suspends the sender, recovery is an admin doing it by hand.

**Error tracking (Sentry) deferred.** Unlike storage and DB config, it is trivially retrofittable
— ten lines and a DSN. **Revisit before the first person who isn't the owner uses the app**, since
it only captures errors occurring after installation and cannot backfill. The argument for it:
server logs cannot see browser failures at all, and this product's riskiest surface is the reader's
device — canvas memory limits on phones, WhatsApp's in-app WebView, Safari dropping the
cross-subdomain cookie. V1 hit exactly this class of bug (`bb89041`, "correct worker URL and canvas
height CSS") and Django would have logged clean 200s throughout.

---

## D17 — No job queue. Bounded retry inside the request.

**Locked** 2026-08-09

WhatsApp sends are synchronous and best-effort; a Twilio failure never breaks the transaction.

**Retry only transient failures** — network error/timeout, HTTP 429, HTTP 5xx. **Never retry 4xx**
(invalid number, unapproved template, recipient opted out): permanent, so retrying is pure delay.
**3 attempts, backoff 0.5s → 1.5s**, worst case ~2s added. Every attempt is recorded in
`MessageLog` with attempt count, final status, and last error, so permanent failures are visible in
admin and re-sendable by hand.

**Known caveat:** if Twilio delivered but the response timed out, a retry sends a duplicate. Twilio
does not dedupe. A duplicate chapter link is harmless; a lost one is not.

**Rejected — a queue now** (Celery/RQ/django-q): means Redis (a sixth external system), a second
process to deploy and monitor, and a class of "the worker is wedged" debugging — before there is a
single reader.

**Cadence later** is a management command on the host's cron. Because every send already goes
through `whatsapp.send_chapter(grant)` (D12), making it async later changes one function's body,
not its callers.

---

## D20 — Shared constants in one file, read by both sides

**Locked** 2026-08-09

```
shared/constants.json      ← the single source of truth
```

Python reads it with `json.load`. TypeScript imports it, wrapped in a thin `.ts` re-export using
`as const` so literal union types survive instead of widening to `string`. No codegen, no build
step. **Only the monorepo makes this possible** — two repos would need a published package.

**Inclusion rule: share it only if a mismatch between the two sides is a bug.**

| In | Why |
|---|---|
| Pace keys (`slow`/`medium`/`fast`) | backend stores, frontend renders |
| Route patterns (`/r/:token`, `/login`, `/read/:chapterId`) | **backend builds WhatsApp links, frontend routes them** — drift means every link in every message 404s |

| Out | Why |
|---|---|
| Display names (Largo/Andante/Allegro) | `labels.ts` only; backend renders no text |
| Pace delays | backend only, env-overridable for the demo |
| Caps and rate limits | enforced backend-side; frontend learns state from the API response |

**Rejected:** codegen from YAML (adds a build step and a "did you regenerate?" failure mode) ·
serving constants from an API endpoint (network round-trip for static data, still untyped) ·
duplicating with a matching test (the fallback if a host isolates the subdirectory).

**Phase 0 verification:** both apps deploy from subdirectories, so `../../shared/` must exist in
each build context. Most hosts clone the whole repo and build from the subdirectory, but not all —
confirm on the real hosts while there is nothing to lose.
# Decisions

Every locked decision, with its reasoning, its rejected alternatives, and what would make us
revisit it. **This folder is the record. `DESIGN.md` is the narrative and points here.**

If a decision is not written here, it is not decided.

## Conventions

- **D-numbers are permanent.** They are referenced from `DESIGN.md`, both `CLAUDE.md` files, and
  code comments. Never renumber. A superseded decision keeps its number and gains a
  `Superseded by` line — it is never deleted, because the reasoning stays useful.
- **Every departure from V1 carries an `Inherited from V1` block**: what V1 did, what V2 does,
  why, what would make us revisit, and whether we are still following V1.
- **Rejected alternatives are recorded**, not just the winner. The rejected option is what someone
  will propose again in six months.
- **Decisions land immediately**, before the turn ends. Sessions end abruptly.

## Index

**Start with [00-why-v2.md](00-why-v2.md)** — the audit of V1 that every decision below traces
back to. Without it these read as taste rather than as answers to specific, observed failures.

| # | Decision | File | Status |
|---|---|---|---|
| D1 | V2 is the same product as V1, rebuilt for control | [product](01-product.md) | locked |
| D2 | Deep specs for active work, a shallow spine for the rest | [process](02-process.md) | locked |
| D3 | Same engineering conventions as V1 (+ two XState departures) | [process](02-process.md) | locked |
| D4 | Domain model: four departures from V1 | [data](04-data.md) | locked |
| D5 | Deploy-first with real external dependencies | [infrastructure](03-infrastructure.md) | locked |
| D6 | Split origin under one parent domain | [infrastructure](03-infrastructure.md) | locked |
| D7 | Auth surface map; chat is token-gated with caps | [api-and-access](06-api-and-access.md) | locked |
| D8 | Grants expire after 7 days | [product](01-product.md) | locked |
| D9 | Expired links recover in one tap | [product](01-product.md) | locked |
| D10 | Readers are created by concierge onboarding | [product](01-product.md) | locked |
| D11 | Home links are session-gated and mint on demand | [api-and-access](06-api-and-access.md) | locked |
| D12 | Message templates in their own config file | [api-and-access](06-api-and-access.md) | locked |
| D13 | The chatbot is a chapter-scoped companion | [product](01-product.md) | locked |
| D14 | The companion never interrupts | [product](01-product.md) | locked |
| D15 | Frontend levels; root machine is two parallel regions | [frontend](05-frontend.md) | locked |
| D16 | Five external systems. No email provider | [infrastructure](03-infrastructure.md) | locked |
| D17 | No job queue. Bounded retry inside the request | [infrastructure](03-infrastructure.md) | locked |
| D18 | Eight tables | [data](04-data.md) | locked |
| D19 | Table specs: User, Book, Chapter, Order | [data](04-data.md) | locked |
| D20 | Shared constants in one file, read by both sides | [infrastructure](03-infrastructure.md) | locked |
| D21 | Table specs: TemporalGrant, MessageLog, ChatUsage, PasswordResetToken | [data](04-data.md) | locked |

## Still open

**See `STATUS.md`.** Open questions are not decisions, and listing them here too would drift —
which is the failure this folder exists to prevent.

Two of them contradict decisions already locked here, so they are worth knowing about while
reading: **#9** (a publicly-openable `/`) amends D7/D11, and **#10** (a signup page) reverses D10.
# Data model

D4 · D18 · D19 · D21

```
User ──< Order >── Book ──< Chapter ──< TemporalGrant >── User
                                 │
                            (PDF file, text_content)
MessageLog >── User, TemporalGrant
ChatUsage  >── TemporalGrant
PasswordResetToken >── User
```

---

## D4 — Four departures from V1's domain model

**Locked** 2026-08-08

**`Shard` entity**
- **V1 did:** `Chapter.shard = OneToOneField(Shard)`; `Shard` held title, slug, file.
- **V2 does:** the file lives on `Chapter`. No `Shard` table. "Shard" survives as product
  vocabulary in the UI, not as a table.
- **Why:** strictly 1:1 — the join bought nothing.
- **Revisit if:** a PDF is shared across books, or a chapter needs multiple files.
- **Follow V1?** ☐ yes ☑ no

**View quota**
- **V1 did:** `max_views = 5` / `current_views`, enforced in `is_valid()`.
- **V2 does:** removed.
- **Why:** appears in no V1 plan document — it arrived in code and was never specced. As written,
  a reader who opens a chapter six times is locked out of a book they paid for. Time-bounded
  access is the product concept; view-counting is a harsher one nobody chose.
- **Revisit if:** anti-sharing enforcement on grant links is ever needed.
- **Follow V1?** ☐ yes ☑ no

**`pace` location** — unchanged, stays on `Order`. A reader may read one book slowly and another
quickly, and it keeps the cadence anchor (`Order.created_at` + pace) in a single row.
**Follow V1?** ☑ yes

**`TemporalGrant.user` nullability**
- **V1 did:** nullable — a leftover from the pre-auth era of anonymous grants.
- **V2 does:** required. Every grant belongs to someone; nullable FKs breed `if grant.user:`
  branches forever.
- **Follow V1?** ☐ yes ☑ no

---

## D18 — Eight tables

**Locked** 2026-08-09

`User` · `Book` · `Chapter` · `Order` · `TemporalGrant` · `MessageLog` · `ChatUsage` ·
`PasswordResetToken`. (Django's own — sessions, admin log, content types, permissions — are not
designed here.)

**`PasswordResetToken` is separate from `TemporalGrant`, not a generic token table.** The
lifecycles differ — a grant is multi-open and lives 7 days; a reset token is **single-use** and
lives about an hour. A generic `Token` with a `purpose` column accumulates `if purpose ==` branches
and serves neither well.

**`ChatUsage` is a real table, not a cache counter** — there is no Redis (D17), it survives
restarts, it is visible in admin, and a counter alone cannot tell you *which* grant burned the
budget after the fact.

**`ChatUsage` never stores message content.** Counts and token usage only. Storing conversations
would help prompt work, but it means retaining private reading-room conversations on a product
whose pitch is quiet, unmonitored reading, and it creates a data-protection obligation that does
not otherwise exist. If conversation data is later wanted, that becomes an explicit opt-in decision
rather than something that quietly accumulated from day one.

---

## D19 — `User`, `Book`, `Chapter`, `Order`

**Locked** 2026-08-09

### `User`
`email` (unique, `USERNAME_FIELD`) · `password` · `full_name` (single field) · `phone` (**unique**,
required, E.164) · `is_staff` / `is_active` / `date_joined` (inherited).

- **`role` dropped.** V1 carried `role` *and* Django's `is_staff`/`is_superuser` — two systems
  answering one question, set together in `create_superuser`, free to drift. Django admin gates on
  `is_staff`, and D10 says admin *is* Django admin, so nothing consumes a domain `role`.
  **Follow V1?** ☐ yes ☑ no
- **`phone` is now unique.** V1 validated format but not uniqueness — survivable when phone was
  only a delivery address, not now that it is the **account-recovery channel** (D16). Two accounts
  sharing a number makes "send me a reset link" ambiguous.
- **`email` stays the login field** — it is what people expect to type. Worth noticing it has
  become the least load-bearing field on the record.
- **Timezone deferred** — a nullable field and one migration whenever cadence needs civilised send
  hours; adding it now would be guessing at the format.

### `Book`
`title` · `slug` (unique) · `price_cents` (kept; payments return per D1) · `is_published` (default
`False`) · `created_at`.

- **`is_published` is new.** Concierge onboarding works against a live database, so without it a
  half-built book with three of eight chapters is immediately assignable.
- **Nothing else yet** — no author, description, or cover until a screen renders them. Fields
  nobody displays are how V1 acquired its unspecced view quota.

### `Chapter`
`book` (FK) · `order_index` (1-based) · `title` · `file` · `text_content` (nullable) · `page_count`
(nullable). `unique_together (book, order_index)`, `ordering = ["order_index"]`.

- **Extraction is explicit, never a signal.** `services/extraction.py` is called by the admin save
  and by `seed_dev`. A `post_save` signal hides a 40-page PDF parse behind an innocuous `.save()`
  — a surprise found only in production. Explicit call, visible failure, re-runnable by command.
- **`page_count` is free** — the PDF is already being parsed for `text_content`, and the reader
  needs it for page controls without re-parsing on every open.
- **Upload path** is a callable producing `chapters/<book_slug>/<order_index>-<uuid>.pdf`. Without
  the UUID, re-uploading a corrected chapter either overwrites silently or gets a mangled suffix,
  and readers with the file cached keep seeing the old one.

> **Deploy checklist — the storage bucket must be private.** `django-storages` can serve files
> publicly, and many tutorials configure exactly that. If it happens here, every PDF gets a
> permanent public URL and the temporal-security mandate, the grant tokens, the 7-day expiry, and
> the whole proxy design are bypassed **at the infrastructure layer while the application code
> still looks correct**. Nothing generates URLs — the API only ever streams bytes.

### `Order`
`user` (FK) · `book` (FK) · `pace` · `created_at`. `unique_together (user, book)`.

- **Stripe fields dropped.** V1's `stripe_session_id` was unique *and required*, which makes a
  concierge-created order impossible to save. `amount_cents` goes with it. Payments add both when
  payments land, by which time their real shape is known (payment intent, refund state, idempotency
  key). The committed seam is `onboarding.create_reader(...)`, not speculative columns.
  **Follow V1?** ☐ yes ☑ no
- **`unique_together (user, book)`** makes `access.can_read` a simple existence check and stops an
  admin double-creating an order and silently doubling a reader's grants.
- **Name kept** — an entitlement today, a purchase record again once payments return. Renaming
  twice is worse than one slightly-early name.
- **`created_at` is the cadence anchor**: chapter N unlocks at `created_at + (N-1) × delay`.

### Pace — neutral keys, poetic labels
```
DB:        "slow" | "medium" | "fast"      ← stable, never migrated for a rename
labels.ts: Largo · Andante · Allegro       ← display only
```
- **Delays live in config** (`content/`, env-overridable for the demo), never in a table and never
  hardcoded in `cadence.py`. A table would let someone change reading-tempo semantics by editing a
  row; a constant means the demo cannot run fast without a code change.
- **Why not V1's `crawl`/`steady`/`soar`:** "Crawl" frames the slowest tier as deficient and "Soar"
  makes the fastest sound aspirational — ranking speed as superior on a product whose pitch is that
  depth beats velocity. Musical tempo is the only metaphor that *is* the mechanism (a rate over
  time) and carries no ranking. Pair each with its literal cadence in the UI — "Largo — a chapter
  each week."
  **Follow V1?** ☐ yes ☑ no

---

## D21 — `TemporalGrant`, `MessageLog`, `ChatUsage`, `PasswordResetToken`

**Locked** 2026-08-09

### `TemporalGrant`
`user` (FK, required) · `chapter` (FK) · `token` (unique) · `expires_at` (`created_at + 7d`) ·
`unlock_at` (nullable, **always null for now** — the cadence seam) · `opened_at` (nullable) ·
`created_at`. Index on `(user, chapter)`.

- **`(user, chapter)` is deliberately NOT unique.** Re-issue (D9, and the Home send button) mints a
  **new row with a new token**; `mint_or_reuse` selects the newest unexpired one.
  *If it were unique*, re-issue would extend `expires_at` in place and **the old token would stay
  valid** — silently reviving access for anyone holding a forwarded expired link, and undoing the
  entire point of 7-day expiry for exactly the case it was designed for. A few extra rows per
  reader per chapter is nothing by comparison. **This looks obviously wrong and is deliberate.**
- **`opened_at` records the FIRST open**, not the last. It is an engagement signal and what the
  deferred unread-reminder keys off. Last-open would be analytics, which we are not collecting.
- **Token default must be a module-level wrapper:**
  ```python
  def generate_token():
      return shortuuid.uuid()
  ```
  V1 lost an entire ticket here — `shortuuid.uuid` is a *bound method* on a module singleton, so
  using it directly as a field default broke every insert at runtime and then sent Django's
  autodetector into an infinite migration loop. The wrapper gives the migration a stable import
  path.

### `MessageLog`
`user` (FK) · `template_key` · `grant` (FK, **nullable**) · `to_phone` · `status`
(`pending`/`sent`/`failed`) · `attempts` · `provider_message_id` (nullable) · `error` (nullable) ·
`created_at` · `sent_at`.

- **`grant` is nullable and is a grant, not a chapter.** Two of the four templates have no chapter
  — password reset is an account message. `grant` also identifies *which token was sent*, so a
  report of a dead link leads straight to the exact grant; chapter is derivable from it.
- **`to_phone` is a snapshot.** A reader changes their number and every historical row would
  otherwise claim messages went somewhere they didn't. Logs record what happened, not what is
  currently true.
- **Never store the rendered body.** It contains a live token — a credential — and duplicating it
  gives two places to leak from instead of one. `template_key` + `grant` reproduces it exactly.
- **Write `pending` before the attempt, update in place.** With no queue (D17), a crash mid-send
  leaves evidence rather than nothing.
- **`sent` means Twilio accepted it, not that it arrived.** True delivery needs Twilio status
  webhooks, which are not scoped. Do not over-trust this field later.

### `ChatUsage`
`grant` (FK) · `date` · `message_count` · `input_tokens` · `output_tokens`.
`unique_together (grant, date)`.

- **Keyed by grant, not user**, because `/api/chat` is token-authenticated (D7) and the caller may
  have no session. The grant carries a user FK for rolling up later.
- **The global ceiling needs no second table** — sum today's rows. Both limits read from env so
  they can be tightened without a deploy.

### `PasswordResetToken`
`user` (FK) · `token` (unique, same wrapper) · `expires_at` (**~1 hour**) · `used_at` (nullable) ·
`created_at`.

- **Single use.** `used_at` is set when the password actually changes. Reset links sit in WhatsApp
  history forever, so a reusable one is a permanent account key.
- **Requesting a new reset invalidates outstanding ones** — otherwise three requests leave three
  live keys.
- **Rate limit: one request per user per 15 minutes.** Without it, "send me a reset link" is a
  button that spams someone's WhatsApp.
# API and access

D7 · D11 · D12

---

## D7 — Auth surface map

**Locked** 2026-08-08

| Surface | Auth |
|---|---|
| `/login`, `POST /api/auth/login` | public |
| `/`, `GET /api/home` | session |
| `/read/:chapterId` | session — mints-or-reuses a grant, then redirects (D11) |
| `/r/:token`, `GET /api/grants/:token` | **token only** |
| PDF bytes | **token only** |
| `POST /api/chat` | **token only** |
| `POST /api/chapters/:id/send` | session |

**Two Ninja auth classes**, mirroring the two dimensions: `SessionAuth` and `GrantAuth` (resolves
the token from the path, checks expiry). Each endpoint declares exactly one. No endpoint accepts
both.

### The consequence we accepted

`/api/chat` is **unauthenticated *and* spends money per call.** Grant links travel over WhatsApp,
get forwarded, and persist in chat history. It is the only endpoint with an uncapped per-request
cost.

**Therefore, built in Phase 5 rather than bolted on:** per-grant daily message cap, a global daily
ceiling as a kill switch, a max input length, and per-grant logging (`ChatUsage`, D21) so spend is
attributable.

**Rejected — requiring a session for chat:** it would delete the feature on phones, which is
exactly where it is most useful, and undercut the reason tokens exist at all.

---

## D11 — Home links are session-gated and mint on demand

**Locked** 2026-08-08

Chapters on Home link to `/read/:chapterId`, which requires the session, finds a live grant or
mints a fresh one, then redirects to `/r/:token`.

**Why:** with 7-day expiry (D8), returning stored tokens would make Home a list of mostly-dead
links — absurd for the one surface that must always work. Resolving at click time makes Home
**structurally incapable** of showing a broken link, and keeps chapter tokens out of the
`GET /api/home` payload entirely.

**Rejected:** returning tokens in the Home payload and refreshing expired ones server-side — mints
grants for chapters never clicked, and puts a pile of live tokens in one response.

**Display:** number, title, and a quiet read/unread mark from `opened_at`. Flat for one book,
grouped for several. No progress bars, percentages, or badges — they fight the product's restraint.

**Account block at top:** name, email, phone, book, logout.

### Send a chapter to my WhatsApp

Every unlocked chapter carries a second action beside opening it.

```
POST /api/chapters/{chapter_id}/send          auth: session
  → access.can_read(user, chapter)            must own it
  → grants.mint_or_reuse(user, chapter)       live grant, or a fresh one
  → whatsapp.send_chapter(grant)              the same seam everything else uses
  → 202 + the MessageLog id
```

**Rate limit: one send per chapter per hour, per reader** — same shape as D9's re-issue limit.
Without it a bored reader burns Twilio credits with a button.

This is the D12 seam paying for itself: no new delivery path, no new template, one endpoint. It
also makes WhatsApp a **library** channel rather than only a delivery one — "push this to my phone
so I can read it on the train" — coherent with 7-day expiry, since re-sending is how an old chapter
is revived.

---

## D12 — Message templates in their own config file

**Locked** 2026-08-08 · extended 2026-08-09 (fourth template)

Mirrors the `labels.ts` mandate: copy is editable without touching send logic. Each entry carries
its internal key, the Meta/Twilio template identifier, its variable order, and a plain-text
rendering used by console dev mode.

**Why this is urgent, not cosmetic:** WhatsApp forbids free-form business-initiated messages
outside a 24-hour window. Every template must be **pre-approved by Meta** — fixed wording, numbered
variables, days of review, resubmission on rejection. **Message copy is a Phase 0 deliverable, not
a Phase 4 one.**

**Submit all four together**, including the cadence-era reminder — an approved unused template
costs nothing and keeps cadence off Meta's critical path later:

1. Chapter delivery
2. Fresh link (D9 re-issue)
3. Unread reminder (cadence-era, submitted early)
4. **Password reset** (D16 — added once we decided against an email provider)

**Triggers, all through one `whatsapp.send_chapter(grant)`:**

| Trigger | Sends |
|---|---|
| `onboarding.create_reader(...)` | chapter 1, automatically |
| Django admin action | that chapter, to that reader |
| `manage.py send_chapter --email --chapter` | same, from the CLI |
| Sanctuary re-issue (D9) | a re-minted grant, rate-limited |
| Home "send to my WhatsApp" (D11) | a minted-or-reused grant, rate-limited |

Cadence later adds another and reuses the same service.

**Dev fallback:** with no Twilio credentials the service prints to console. Local work and CI never
touch the network or spend money.

**Open — this gates everything:** the template copy itself. Deferred until the overall picture is
clear; it **blocks Meta submission → the Phase 4 demo.** Close it early.
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
# Frontend architecture

D15

Full implementation spec lives in `apps/web/CLAUDE.md`. This records *why*.

---

## D15 — Three levels; the root machine is two parallel regions

**Locked** 2026-08-09

### Three levels

| Level | Owner | Knows about |
|---|---|---|
| 0 | root machine (`src/pages/machine/`) | session state, and which page is showing |
| 1 | page machines (`src/pages/<page>/machine/`) | what happens inside one page |
| 2 | component machines (`src/components/<C>/machine/`) | async work inside one component |

**Nothing from a lower level may appear in a higher one.** Diagnostic: if the root machine grows a
field named after a domain object (`token`, `grant`, `chapterId`), level 1 has leaked into level 0.
Its context is **one field** — `user`.

This rule was arrived at by correction. The first draft of the root machine carried grant fetching,
sanctuary sub-states, `finished`, and retry — three levels of work in one machine. The second draft
still had `login.idle` / `login.submitting`, which is the login page's UI lifecycle, not
navigation.

**A component earns a `machine/` only if it owns async work or a lifecycle independent of its
page.** `PdfChamber` and `Companion` qualify; `ChapterList`, `AccountBlock`, `Button`, `TextField`,
`Spinner`, `ErrorNotice` do not. Without this rule, "components have their own machines" becomes
twelve machines for five screens.

### Parallel regions, not pages nested under auth states

```
navigation (type: parallel)
├── session   checking · anonymous · authenticated · loggingOut
└── page      unknown · home · login · opening · reader
```

**Why:** auth status and which-page-you're-on are independent dimensions. Nesting forces every page
to pick a side — which made `/` impossible to open logged-out and required `reader` to be
special-cased as a top-level sibling.

With parallel regions, `session.checking` + `page.reader` is a valid state — **exactly a WhatsApp
visitor on a cookie-less phone.** Because the page region never waits on the session region, a
token link cannot be bounced to `/login` by a pending auth check.

**This deleted two footguns that were previously handled by rules:**
1. `reader` needing to be a top-level sibling "or every WhatsApp link dies."
2. The machine starting at `idle` rather than `booting` so a token link would skip the session
   check.

Both are now impossible by construction. That is the signal it is the right shape.

### Navigation is unidirectional through the URL

`NAVIGATE { to }` transitions nothing — it pushes the URL, which returns as `ROUTE`. One
path→state mapping, no canonical-path table, no machine↔URL loop to guard against.

### Page machines are independent, never invoked as children

**Invoke a child machine only when the parent must react to its state or cancel it.** The root
machine does neither — it only cares which page is showing, which it knows from its own state.

**Rejected — invoking page machines as children** (for "one tree"): forces every child event
through the root's type surface, so the root grows with every page, and makes page machines
untestable without booting the root and driving it into position. The tree is delivered by the
navigation hierarchy itself (`chamber.sanctuary.sending` is a real nested path), not by a
machine-of-machines.

Pages own their data with their own `useMachine` and call `useNavigation()` to move.

### Settled details

- **`checkSession` runs on boot for everyone**, including token visitors, who 401 harmlessly. One
  wasted request, in exchange for deleting a special case that would otherwise have to be
  remembered forever.
- **Unrecognised paths fall through to `home`**, not a 404 screen.
- **Logout clears the local session even if the API call fails** — a failed logout must not strand
  the user in an authenticated-looking UI.
- **No redirect-after-login.** Always land on home. The only protected deep link is
  `/read/:chapterId`, reached only from Home, where you are already authenticated.
- **`finished` is a real state**, rendered minimally — it is the anchor D14's deferred
  end-of-chapter companion question attaches to.
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
# CLAUDE.md — apps/web

React + Vite + TypeScript, XState v5, Framer Motion, vanilla CSS. Serves `app.<domain>`.

Root context: `../../CLAUDE.md`. Design and decisions: `../../DESIGN.md`.

## Routes

| Route | Auth | Notes |
|---|---|---|
| `/login` | public | email + password |
| `/` | session | Home — account block + chapters |
| `/read/:chapterId` | session | mints-or-reuses a grant, then redirects (D11) |
| `/r/:token` | **token only** | the chamber. **No session required** — this is what makes WhatsApp links work |

Full surface map: `DESIGN.md` D7.

## Mandates

1. **Zero hardcoded strings.** Every piece of UI text goes through `src/lib/labels.ts` and is read
   via `locale.ts`. No exceptions — V1's login PR was blocked in review for a single hardcoded
   `"Welcome back,"`.
2. **Machine-first logic.** Complex UI state is an XState machine with the 5-file split:
   `machine.ts`, `actions.ts`, `guards.ts`, `actors.ts`, `index.ts`. Not scattered `useState`.
3. **No `as any`.** V1's first frontend PR was blocked for `as any` casts across eight files and
   for weakening `locale()`'s return type to `any`. The API is typed on the backend; keep it typed
   here.
4. **Variable Velocity.** Animations start fast, settle slow.

## XState conventions

Derived from V1's `create-machine` skill, with three fixes for gaps found in V1's actual code.

### Location — one, no exceptions

```
src/pages/<page>/machine/
```

*V1 ran two competing conventions simultaneously (`src/machines/login/` and
`src/pages/reading-room/machine/`). One location.*

### Six files

| File | Contains |
|---|---|
| `types.ts` | `Context` and the `Event` union. **New in V2** — see below |
| `machine.ts` | `createMachine` only. Purely declarative: string references for actions, actors, guards. No implementations |
| `actions.ts` | individual `const`s using `assign`, collected into one exported `actions` object |
| `actors.ts` | `fromPromise` actors calling `mappedFetcher`, collected into one exported `actors` object |
| `guards.ts` | individual **named exports**, no wrapper object (imported via `import * as guards`) |
| `index.ts` | `machine.provide({ actions, actors, guards })` |

Omit `actors.ts` only when a machine genuinely has no async work. **Never add a seventh file** —
V1's landing machine grew `fields.ts` and `services.ts`, which is the signal a machine is doing
too much. Split it instead.

### `types.ts` — why V2 adds it

V1's convention said "define context as a plain object literal, no type annotations." That makes
every event access untyped, which forces casts:

```ts
return { token: (event as any).token as string };          // V1 reading-room
export const isInvalidCredentials = ({ event }: { event: any }) => …
```

So V1's `as any` spam wasn't sloppiness — the convention required it, while the mandate above
forbids it. The two rules contradicted each other. `types.ts` resolves it:

```ts
// types.ts
export type Context = {
  token: string;
  chapter: Chapter | null;
  errorMessage: string | null;
};

export type Event =
  | { type: "SET_TOKEN"; token: string }
  | { type: "RETRY" };
```

```ts
// machine.ts
import { createMachine } from "xstate";
import type { Context, Event } from "./types";

export const readerMachine = createMachine({
  types: {} as { context: Context; events: Event },
  id: "reader",
  initial: "idle",
  context: { token: "", chapter: null, errorMessage: null },
  states: { /* … */ },
});
```

Actions, guards, and actors now infer their parameters. **No casts anywhere.**

Still simple TypeScript: two type aliases, no `satisfies`, no explicit generics, no wrapper types.

### Style

- Actions use `assign` returning a plain object to merge into context. Side-effecting actions
  (fire-and-forget calls) are plain functions, not `assign`.
- Guards are plain functions returning boolean.
- Events are `{ type: "UPPER_SNAKE_CASE" }`.
- Components consume via `useMachine`; render on `state.matches("x")`, read `state.context.y`,
  transition with `send({ type: "EVENT" })`.

### Naming

`sanctuary` means the **expired/invalid link** state (`DESIGN.md` D8/D9). V1's reading-room
machine reused the word for end-of-chapter — don't. Call that one `finished`.

## API calls — always through `lib/fetcher.ts`

`mappedFetcher` is the only way this app talks to the API. **V1's skill mandated it but it was
never built**, so every actor hand-rolled `fetch` plus its own error class (`LoginError`,
`GrantFetchError` — duplicated per machine), and hardcoded `localhost` URLs reached review twice.

Build it in Phase 0. It owns:

- **The API base URL**, from env. Never hardcode a host.
- **`credentials: "include"`** on every request — the session cookie is scoped to the parent
  domain (D6), and a single call that forgets this fails in a way that looks like a backend bug.
- **One error shape carrying `status`**, so guards stay one-liners:
  `export const isNotFound = ({ event }) => event.error.status === 404;`
- JSON encoding/decoding, so actors read `return mappedFetcher.get("/grants/" + token)`.

---

# Architecture — three levels

Each level knows only its own concerns. This is the rule that keeps the root machine small.

| Level | Owner | Knows about |
|---|---|---|
| **0** | root machine (`src/pages/machine/`) | session state, and which page is showing |
| **1** | page machines (`src/pages/<page>/machine/`) | what happens inside one page |
| **2** | component machines (`src/components/<C>/machine/`) | async work inside one component |

**Nothing from a lower level may appear in a higher one.** If the root machine grows a field
named after a domain object (`token`, `grant`, `chapterId`), that is the symptom — it belongs to
a page.

**A component earns a `machine/` only if it owns async work or a lifecycle independent of its
page.** `PdfChamber` and `Companion` qualify. `ChapterList`, `AccountBlock`, `Button`,
`TextField`, `Spinner`, `ErrorNotice` do not — they render props.

**Page machines are independent, never invoked as children of the root machine.** Invoke a child
only when the parent must react to its state or cancel it; the root machine does neither. It only
cares which page is showing, which it knows from its own state. Invoking would force every child
event through the root's type surface and make page machines untestable in isolation. Pages own
their data with their own `useMachine` and call `useNavigation()` to move.

# File structure

Every folder — component or page — is `index.tsx` + `<Name>.css` + an optional `machine/`.
One rule, no exceptions.

```
src/
├── main.tsx                        mount, import global styles
├── App.tsx                         mounts Router + <Navigator/>. No logic.
│
├── styles/                         reset.css · tokens.css · global.css
├── lib/                            env.ts · fetcher.ts · labels.ts · locale.ts
│
├── components/
│   ├── Button/ · TextField/ · Spinner/ · ErrorNotice/
│   ├── AccountBlock/
│   ├── ChapterList/                index.tsx · ChapterRow.tsx · ChapterList.css
│   ├── PdfChamber/                 + machine/
│   └── Companion/                  + machine/
│
└── pages/
    ├── index.tsx                   THE NAVIGATOR — useMachine(navigationMachine),
    │                               provides NavigationContext, renders a page per state
    ├── useNavigation.ts            hook → [state, send] for any page
    ├── machine/                    THE ROOT MACHINE
    │   ├── types.ts · machine.ts · actions.ts · actors.ts · guards.ts · index.ts
    │   └── sync.ts                 URL → machine adapter
    │
    ├── login/                      index.tsx · login.css · machine/
    ├── home/                       index.tsx · home.css · machine/
    ├── opening/                    index.tsx · machine/        (/read/:chapterId)
    └── reader/                     index.tsx · reader.css · machine/
                                    + Sanctuary.tsx (shares the /r/:token route)
```

# The root machine — level 0

## Boundary

**Owns:** session state, and which page is showing.
**Does not own:** anything inside a page.

Context is **one field** — `user`. Events are **four**. Invokes are **two**. If it grows past
that, something from level 1 has leaked in.

## Shape: two parallel regions

```
navigation  (type: parallel)

├── session
│   ├── checking          invoke checkSession
│   │     onDone  → authenticated       assignUser
│   │     onError → anonymous
│   ├── anonymous         AUTHENTICATED → authenticated  [assignUser, goToHome]
│   ├── authenticated     LOGOUT → loggingOut
│   └── loggingOut        invoke logoutActor
│         onDone / onError → anonymous  [clearUser, goToLogin]
│
└── page
    ├── unknown           renders nothing — prevents a Home flash before the first ROUTE
    ├── home
    ├── login
    ├── opening           /read/:chapterId
    └── reader            /r/:token
```

**Why parallel, and not pages nested under auth states.** Auth status and which-page-you're-on
are independent dimensions. Nesting forces every page to pick a side, which made `/` impossible
to open logged-out and required `reader` to be special-cased as a top-level sibling.

With parallel regions, `session.checking` + `page.reader` is a valid state — that is exactly a
WhatsApp visitor on a phone with no cookie. **Because the page region never waits on the session
region, a token link can never be bounced to `/login` by a pending auth check.** `DESIGN.md` D1 is
satisfied structurally, not by a rule someone must remember.

## Root-level events

```
on ROUTE:                        (sync.ts is the only sender)
  guard isReaderPath   → .page.reader
  guard isLoginPath    → .page.login
  guard isOpeningPath  → .page.opening
  (default)            → .page.home

on NAVIGATE:  actions: pushUrl   ← no target
```

**Navigation is unidirectional: all of it flows through the URL.** `NAVIGATE` transitions
nothing — it pushes the URL, which returns as `ROUTE`. One path→state mapping, no canonical-path
table, and no machine↔URL loop to guard against.

| Event | Sent by |
|---|---|
| `ROUTE { path }` | `sync.ts` — mount, popstate, and after any `pushUrl` |
| `NAVIGATE { to }` | any page asking to move |
| `AUTHENTICATED { user }` | login page, after a successful call |
| `LOGOUT` | account block |

## Implementation inventory

**Actors** — `checkSession` (`GET /api/auth/me`) · `logoutActor` (`POST /api/auth/logout`).
Login is **not** here — it belongs to the login page, which needs `submitting` and error states
for its own form anyway.

**Guards** (bare named exports, matching `event.path`) — `isReaderPath` · `isLoginPath` ·
`isOpeningPath`.

**Actions** — `assignUser` · `clearUser` (both `assign`), plus three side-effecting router calls
that are **not** `assign`: `pushUrl` (from `event.to`) · `goToHome` · `goToLogin`.

**`sync.ts`** — on mount and on `popstate`, send `ROUTE { path: location.pathname }`. That is its
entire job; the machine never pushes URLs except through the three actions above.

## What each page machine owns

| Page | Its machine handles |
|---|---|
| `login` | `idle → submitting → error`; calls `loginActor`; sends `AUTHENTICATED` up |
| `home` | `loading → ready / empty / error`; the chapter list |
| `opening` | `resolving`; calls `resolveChapterActor`; then `NAVIGATE` to `/r/:token` |
| `reader` | `loading → reading → finished / sanctuary / error`; grant fetch; one-tap re-issue |

Protected pages enforce their own access: `opening` reads session status from the root context and
sends `NAVIGATE { to: "/login" }` if anonymous. It must **wait for `session.checking` to settle**
rather than assuming anonymous.

## Deliberate choices — do not relitigate

- **`checkSession` runs on boot for everyone**, including token visitors, who 401 harmlessly.
  One wasted request, in exchange for deleting a special case that would otherwise have to be
  remembered forever.
- **Unrecognised paths fall through to `home`**, not a 404 screen.
- **Logout clears the local session even if the API call fails** — a failed logout must not
  strand the user in an authenticated-looking UI.
- **No redirect-after-login.** Always land on home.
- **`locale()` is retained** from V1, typed to return `string`. V1 weakened it to `any` and the PR
  was blocked for it.

## Design intent

From `BUSINESS.md`, still binding for the chamber: **Apple-clean, not fancy. Uninterrupted** — no
timers, no progress bars, no session metadata, no nudges. Auto-fading chrome. Soft expiry, no
shouting.

This is why the companion panel sits silent until *you* open it (D14), and why Home shows a quiet
read/unread mark rather than progress bars (D11).

## Pitfalls from V1

- **Three competing Reading Room implementations** existed simultaneously (`ShardView`,
  `ReadingRoomView`, `pages/reading-room/`). Before building a screen, check nothing already does
  it. Delete what you replace.
- **Unplanned features landing on main.** The Oracle chatbot arrived in two unticketed commits.
  Features get designed first — see `DESIGN.md`.
- **Session persistence.** V1 shipped login without it and filed it as a future note. Rehydrate
  from `GET /api/auth/me` on boot.
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

- `access.can_read(user_or_token, chapter)` — the only access check. **No caller queries `Order`
  or `TemporalGrant` directly.** Cadence and subscriptions extend this function; they don't add
  parallel checks.
- `onboarding.create_reader(name, email, phone, book, pace)` — the only way a reader comes into
  existence. User + Order + first grant atomically, delivery post-commit.
- `whatsapp.send_chapter(grant)` — the only delivery path.

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
# CLAUDE.md — Sapien Paradox V2

## What this is

A modular, cadence-paced learning platform for "Intellectual Explorers." A reader buys a book;
its chapters unlock on a schedule; each arrives by WhatsApp as a self-authenticating link; they
read it in a token-gated chamber and discuss it with a companion.

**V2 is the same product as V1, rebuilt so every piece is deliberate.** V1 lives at
`../Sapien Paradox App` and is **read-only reference**.

## Read first

| File | When |
|---|---|
| **`STATUS.md`** | always — current focus, next action, open questions |
| **`DESIGN.md`** | what we're building and how it fits together |
| **`decisions/`** | before proposing anything structural — every locked decision and *why* |
| `apps/api/CLAUDE.md` | working on the backend |
| `apps/web/CLAUDE.md` | working on the frontend |

**Most structural questions are already decided.** `decisions/README.md` indexes all of them by
number (D1…D21) with rejected alternatives and V1 provenance. Check there before proposing —
the option you're about to suggest may already have been considered and ruled out for a recorded
reason.

Decisions live in `decisions/` and **nowhere else**. `DESIGN.md` references them by number. If you
find the same decision written in two places, that is a bug — V1 died of exactly that.

## Layout

```
apps/api/     Django 6 + Django Ninja + Postgres   → has its own CLAUDE.md
apps/web/     React (Vite) + TS + XState           → has its own CLAUDE.md
docs/         operational docs (setup, deploy)
DESIGN.md     what we're building and why
STATUS.md     what's happening now
```

Monorepo, one git history. **A vertical slice is one PR** spanning both apps — V1 split repos by
lane and every feature had to be split in half with manual cross-repo merge ordering.

Deployed as `app.<domain>` (static SPA) + `api.<domain>` (Django), session cookie scoped to the
parent domain. See D6.

## The three seams

Everything routes through these; nothing bypasses them. This is what makes payments and cadence
drop-ins later rather than second implementations.

- **`access.can_read(user_or_token, chapter)`** — the only access check. Never query `Order` or
  `TemporalGrant` directly.
- **`onboarding.create_reader(...)`** — the only way a reader comes into existence.
- **`whatsapp.send_chapter(grant)`** — the only delivery path.

*Anything a human can do in Django admin, a service function does.*

## Engineering mandates

1. **Zero hardcoded strings** — UI text via `labels.ts`; message templates and the companion
   prompt in their own config files, editable without touching logic.
2. **Machine-first logic** — complex UI state is an XState machine with the 5-file split.
3. **Temporal security** — never expose a storage URL; always proxy bytes through the API.
4. **Type-safe API** — Ninja schemas on every request/response body; no untyped dicts at the
   boundary, no `as any` on the frontend.
5. **Variable Velocity** — animations start fast, settle slow.
6. **Env-driven externals** — anything touching the outside world reads env and has a
   console/no-op fallback. A fresh clone runs with zero credentials.

## Working discipline

- **BFS** — root before leaves, exhaust a level before descending. One question at a time, always
  with a recommended answer.
- **Decisions land immediately** in `DESIGN.md`, not at end of turn. Sessions end abruptly.
- **Every departure from V1** carries an `Inherited from V1` block: what V1 did, what V2 does,
  why, what would make us revisit.
- **One canonical doc per question.** If a new doc would overlap an existing one, edit the
  existing one. V1 had three docs answering "what are we building" and they drifted apart.
- **Simple over fancy.** Complexity must earn its keep.
