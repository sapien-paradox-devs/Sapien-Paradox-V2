# Status — what we have, what we need to do

> Current state and open work. Changes every session.
>
> **Decisions are not here.** `decisions/` holds every locked decision with its reasoning, indexed
> in `decisions/README.md`. **What we're building is not here either** — that's `DESIGN.md`.
> This file tracks state and actions only.
>
> **This is not a diary.** V1's equivalent accumulated a 24-entry narrative log nobody could use.
>
> **Resuming after a break?** `docs/HANDOFF-2026-08-30.md` is the narrative of the machine-layer
> session — the PR stack and its merge order, the XState traps, and what was proven about Razorpay
> and Twilio. Read it once; work from here afterwards.

**Last updated:** 2026-08-30

---

# 1. What we have

## The repository

**https://github.com/sapien-paradox-devs/Sapien-Paradox-V2** — private, monorepo, both CI workflows
green. **13 issues open** (#1 the PRD, #2 closed), **PR #14 open and green**.

One repo, two independently deployable apps. Chosen over V1's split repos: five of the twelve
planned slices touch both sides in one change, and `shared/constants.json` would otherwise need a
published package on two ecosystems to sync nine values.

## Code — running, not just written

| | State |
|---|---|
| `apps/api` | Django 6.0.8 + Ninja. Boots, migrates, tests pass. `GET /api/health` live |
| `apps/web` | React 19 + Vite 6 + XState 5. Builds clean |
| `shared/constants.json` | pace keys + route patterns, read by both sides (D20) |
| CI | two path-filtered workflows, **no credentials** — proves a fresh clone runs |
| Deploy commands | `gunicorn config.wsgi:application` and `collectstatic` verified locally |

**All eight tables exist** with admin screens and 21 tests, merged as #14. `User` shipped in the
bootstrap because `AUTH_USER_MODEL` must exist in migration `0001`.

**The machine layer is built and unmerged** — 12 stacked PRs, #33–#37 (backend) and #38–#44
(frontend). Backend 75 tests, frontend 56 plus a test runner the app did not have. Merge order is in
the handoff; merging out of order conflicts.

**It is scaffolding, not the application.** The machines call the three seams through injected
callables and are tested against fakes. `core/services/` still does not exist.

**R2 is live and proven** — private bucket, public URL disabled, a real PDF read server-side and
parsed with pypdf. `render.yaml` provisions the API and Postgres but nothing is deployed yet.

## Documents

| File | Holds |
|---|---|
| `CLAUDE.md` | how to work here — **workflow**, stack, seams, mandates |
| `README.md` | what this is, how to run it, where things are written down |
| `DESIGN.md` | product, scope, architecture, data model, roadmap |
| `decisions/` | **28 locked decisions** with rationale, rejected alternatives, V1 provenance |
| `decisions/00-why-v2.md` | the V1 audit every decision traces back to |
| `apps/api/CLAUDE.md` · `apps/web/CLAUDE.md` | per-app architecture |
| `apps/api/BUILD.md` | backend build order, S0–S11, with the gates |
| `docs/RUNNING.md` | setup, commands, environment, CI, deploy, troubleshooting |

## Workflow — new, and now in force

**Issue → branch → one PR → merge.** Branch is `<issue-number>-<slug>`, PR body says `Closes #n`,
never commit code straight to `main`. **Markdown is exempt** — decisions must land the moment
they're made.

The backlog is open: 12 slice issues plus the PRD. #2 (skeleton) closed, #5 (tables) on PR #14.

## Design — locked

| Area | Where |
|---|---|
| Product, scope, roadmap | D1, D2, D8–D14, D24 |
| Infrastructure, vendors, external systems | D5, D6, D16, D17, D20, D22, D23 |
| Frontend architecture + root machine | D15 · spec in `apps/web/CLAUDE.md` |
| Backend layering, structure, data model (8 tables) | D4, D18–D21 · spec in `apps/api/CLAUDE.md` |
| **The machine layer** — flow in transition tables, effects in services | **D36–D40** · `decisions/10-machines.md` |
| **The four page machines and how they fail** | **D41–D45** · `decisions/05-frontend.md` |

## Design — NOT started

- ~~**The three seams**~~ — **locked 2026-08-25 as D25–D27** (`decisions/07-seams.md`). Signatures,
  transaction boundaries, and failure behaviour all decided; gate G3 is closed.
- **Four API-layer questions** — PDF endpoint name, CSRF policy, cap placement, GET honesty.
  Proposed answers in `apps/api/BUILD.md` as gates G1, G2, G5, G6; none locked.
- **Rate-limit mechanism** — cooldown windows are in `settings.py` and env-overridable, but *how*
  they're counted (rows in `MessageLog` / `PasswordResetToken`) is proposed, not decided.
- **Level 3 detail** — copy, validation, animation, prompt craft. Deferred by decision.

---

# 2. What we need to do

## Track A — start the clock *(calendar time; cannot be compressed)*

- [ ] **Register the domain** on Cloudflare — everything downstream embeds it
- [ ] **Finalise the four WhatsApp template copies** — chapter delivery, fresh link, unread
      reminder, password reset
- [ ] **Twilio account** → WhatsApp sender application → **submit all four templates**
      *(a trial account and the sandbox are already proven: a real message reached a handset,
      status `delivered`. Templates are still mandatory — every cadence message is
      business-initiated and therefore always outside the 24-hour window.)*
- [x] ~~Decide the payment provider~~ — **Razorpay (D28)**, and **proven**: a real ₹10 test
      payment completed (`plink_TVf5nhHQomnoOh`). Test mode is domestic-only
- [ ] **Start Razorpay KYC** — days to weeks, and independent of Meta's clock

**Nothing here has started.** Meta approval is days-to-weeks of waiting and gates the demo.

## Track B — close the design gaps *(unblocks all backend code)*

- [x] **Grill the three seams** (gate G3) — locked as D25–D27
- [ ] Close G1, G2, G5, G6 — one-line answers, already proposed
- [ ] Decide the rate-limit mechanism (G4)

## Track C — build

- [x] **Phase 0** — monorepo, Django + Ninja, `DATABASE_URL`, `django-storages`, Vite + React +
      XState, `labels.ts`, `shared/constants.json`, path-filtered CI
- [ ] **Phase 0 remainder** — **both sides actually deployed** (D5 says deploy before there's much
      to deploy; this is now the oldest unpaid debt)
- [ ] **Phase 1** — auth endpoints, boot rehydration, cross-subdomain cookie. *(`/login` and its
      machine are built, on PR #40 — waiting on a backend to call.)*
- [ ] **Phase 2** — remaining 7 models, the three seams, `GET /api/home`, `/read/:chapterId`,
      Home screen, Django admin onboarding, `seed_dev`
- [ ] **Phase 3** — grant + PDF endpoints, `/r/:token`, sanctuary, 7-day expiry
- [ ] **Phase 4** — Twilio + console backends, `MessageLog`, admin action, CLI, re-issue
- [ ] **Phase 5** — `text_content` extraction, `POST /api/chat`, caps, panel, versioned prompt
- [ ] **Phase 6** — end-to-end test, complete seed

Tracks A and B run concurrently. Phases 3 and 4 run in parallel after Phase 2.

## Housekeeping

- [ ] **Merge or re-cut the 12 stacked PRs.** Nothing above the base of each stack can land until
      its base does — see the handoff for the order
- [ ] **Write the three seams** (D25–D27). Locked, and written nowhere. Every machine waits on them
- [ ] Commit `docs/ARTIFACTS.md` to `main` — currently untracked

- [ ] **Open the issue backlog** — nothing code-shaped can start without it
- [ ] **Delete `ALL_DOCUMENTATION.md` and `UNIFIED_SPEC.md`** — 3,400 lines of concatenated copies
      of the six real documents, already stale (neither mentions D24 or the workflow rule).
      Duplication is what killed V1
- [ ] **Amend D20** — it assumed `as const` preserves literal unions on JSON imports. It doesn't;
      TypeScript widens to `string[]`. The union is declared in `src/lib/constants.ts` with a
      load-time assertion against the JSON

---

# 3. Open questions

| # | Question | Blocks | Default if unanswered |
|---|---|---|---|
| 1 | **Message template copy** (4 templates) | **Meta approval → the demo** | I draft them for review |
| 2 | **Domain name** | Track A entirely — templates embed the URL | — must be chosen |
| 3 | Hosts confirmation | deploy | Cloudflare Pages + Render + managed Postgres + R2 (D23) |
| ~~4~~ | ~~Payment provider~~ | — | **CLOSED — Razorpay (D28).** KYC not yet started |
| 5 | Companion interaction design + system prompt | Phase 5 | its own session (D14) |
| 6 | Read/unread mark on Home — keep or drop | Phase 2 | keep (D11) |
| 7 | **What does an anonymous visitor see at `/`?** Amends D7/D11 | Phase 2 | redirect to `/login` |
| 8 | **Is a signup page in scope?** Contradicts D10 | Phase 1 | no — D10 stands |
| 9 | PDF endpoint name (G1) | Phase 3 | `/api/grants/{token}/pdf` — `Shard` no longer exists |
| 10 | CSRF policy (G2) | Phase 1 | enforce on session endpoints, exempt grant-authenticated |
| 11 | Where chat caps live (G6) | Phase 5 | `services/companion.py` |
| 12 | Is `GET /api/read/{id}` honest as a GET? (G5) | Phase 2 | keep GET, make it idempotent |
| 13 | **Two departures made while building** — expiry derived rather than stored (#20), and no `react-pdf` (#31) | reviewing #34 and #43 | keep both; each is argued in its PR |

**#7 and #8 are coupled:** a public `/` with a signup path is a coherent product; a gated `/` with
signup isn't.

**#2 (the domain) is now the only one blocked on you specifically.** Everything else has a workable
default.

---

# 4. External services

| # | Service | For | Cost | Lead time | Status |
|---|---|---|---|---|---|
| 1 | **Cloudflare** | registrar · DNS · Pages · R2 | free / ~$10yr | hours | **R2 done** · domain not started |
| 2 | **Twilio** | WhatsApp delivery, recovery, password reset | per message | minutes | **sandbox proven** · WABA not started |
| 3 | **Meta Business** *(via Twilio)* | business verification + 4 template approvals | — | **days–weeks** | not started |
| 4 | **Render** | Django + managed Postgres | **~$5–7/mo** | minutes | not started |
| 5 | **Anthropic** | the companion (Sonnet 5) | per token | minutes | not started |
| 6 | GitHub | source, CI | free | — | **live** |
| 7 | **Razorpay** | payments — later (D28) | ~2% domestic | **days–weeks KYC** | **test keys proven** · KYC not started |

**Deliberately not integrating:** email provider (D16 — WhatsApp is the only outbound channel) ·
log vendor (D22 — stdout to host viewer) · Redis/queue (D17 — bounded in-request retry) ·
Sentry (D16 — deferred; revisit before the first non-owner user).

**Total running cost: ~$5–7/month** plus per-message and per-token usage.

---

# 5. V1 is read-only reference

`../Sapien Paradox App`. Consult it for working code (Stripe service, auth endpoints,
reading-room machine, `labels.ts`) and for the `Inherited from V1` blocks. The full audit of what
went wrong is `decisions/00-why-v2.md`.

**Do not trust V1's own documentation.** Its `frontend/CLAUDE.md` lists `src/lib/fetcher.ts` in the
architecture map; the file does not exist. Verify before relying on it.
