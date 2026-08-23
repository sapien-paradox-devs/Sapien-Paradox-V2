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
