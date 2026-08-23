# Status — what we have, what we need to do

> Current state and open work. Changes every session.
>
> **Decisions are not here.** `decisions/` holds every locked decision with its reasoning, indexed
> in `decisions/README.md`. **What we're building is not here either** — that's `DESIGN.md`.
> This file tracks state and actions only.
>
> **This is not a diary.** V1's equivalent accumulated a 24-entry narrative log nobody could use.

**Last updated:** 2026-08-23

---

# 1. What we have

## The repository

**https://github.com/sapien-paradox-devs/Sapien-Paradox-V2** — private, monorepo, three commits on
`main`, both CI workflows green.

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

**Models: `User` only.** It shipped in the bootstrap because `AUTH_USER_MODEL` must exist in
migration `0001` — changing it later is a painful manual migration. The other seven tables (D18)
are their own slice.

## Documents

| File | Holds |
|---|---|
| `CLAUDE.md` | how to work here — **workflow**, stack, seams, mandates |
| `README.md` | what this is, how to run it, where things are written down |
| `DESIGN.md` | product, scope, architecture, data model, roadmap |
| `decisions/` | **24 locked decisions** with rationale, rejected alternatives, V1 provenance |
| `decisions/00-why-v2.md` | the V1 audit every decision traces back to |
| `apps/api/CLAUDE.md` · `apps/web/CLAUDE.md` | per-app architecture |
| `apps/api/BUILD.md` | backend build order, S0–S11, with the gates |
| `docs/RUNNING.md` | setup, commands, environment, CI, deploy, troubleshooting |

## Workflow — new, and now in force

**Issue → branch → one PR → merge.** Branch is `<issue-number>-<slug>`, PR body says `Closes #n`,
never commit code straight to `main`. **Markdown is exempt** — decisions must land the moment
they're made.

**Consequence: no further code can start until issues exist.** The twelve-slice breakdown is
drafted but unapproved, and no issues are open.

## Design — locked

| Area | Where |
|---|---|
| Product, scope, roadmap | D1, D2, D8–D14, D24 |
| Infrastructure, vendors, external systems | D5, D6, D16, D17, D20, D22, D23 |
| Frontend architecture + root machine | D15 · spec in `apps/web/CLAUDE.md` |
| Backend layering, structure, data model (8 tables) | D4, D18–D21 · spec in `apps/api/CLAUDE.md` |

## Design — NOT started

- **The three seams** — `access.can_read`, `onboarding.create_reader`, `whatsapp.send_chapter`.
  Signatures, transaction boundaries, failure behaviour. **Everything routes through these.**
- **Four API-layer questions** — PDF endpoint name, CSRF policy, cap placement, GET honesty.
  Proposed answers in `apps/api/BUILD.md` as gates G1–G6; none locked.
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
- [ ] **Decide the payment provider**, then start KYC — *blocked on an open question, see §3*

**Nothing here has started.** Meta approval is days-to-weeks of waiting and gates the demo.

## Track B — close the design gaps *(unblocks all backend code)*

- [ ] **Grill the three seams** (gate G3) — the only one that needs a real session
- [ ] Close G1, G2, G5, G6 — one-line answers, already proposed
- [ ] Decide the rate-limit mechanism (G4)

## Track C — build

- [x] **Phase 0** — monorepo, Django + Ninja, `DATABASE_URL`, `django-storages`, Vite + React +
      XState, `labels.ts`, `shared/constants.json`, path-filtered CI
- [ ] **Phase 0 remainder** — **both sides actually deployed** (D5 says deploy before there's much
      to deploy; this is now the oldest unpaid debt)
- [ ] **Phase 1** — auth endpoints, `/login` + machine, boot rehydration, cross-subdomain cookie
- [ ] **Phase 2** — remaining 7 models, the three seams, `GET /api/home`, `/read/:chapterId`,
      Home screen, Django admin onboarding, `seed_dev`
- [ ] **Phase 3** — grant + PDF endpoints, `/r/:token`, sanctuary, 7-day expiry
- [ ] **Phase 4** — Twilio + console backends, `MessageLog`, admin action, CLI, re-issue
- [ ] **Phase 5** — `text_content` extraction, `POST /api/chat`, caps, panel, versioned prompt
- [ ] **Phase 6** — end-to-end test, complete seed

Tracks A and B run concurrently. Phases 3 and 4 run in parallel after Phase 2.

## Housekeeping

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
| 4 | **Payment provider** — Stripe vs Razorpay/Cashfree | KYC clock | **needs: where is the business registered, and where are the readers?** |
| 5 | Companion interaction design + system prompt | Phase 5 | its own session (D14) |
| 6 | Read/unread mark on Home — keep or drop | Phase 2 | keep (D11) |
| 7 | **What does an anonymous visitor see at `/`?** Amends D7/D11 | Phase 2 | redirect to `/login` |
| 8 | **Is a signup page in scope?** Contradicts D10 | Phase 1 | no — D10 stands |
| 9 | PDF endpoint name (G1) | Phase 3 | `/api/grants/{token}/pdf` — `Shard` no longer exists |
| 10 | CSRF policy (G2) | Phase 1 | enforce on session endpoints, exempt grant-authenticated |
| 11 | Where chat caps live (G6) | Phase 5 | `services/companion.py` |
| 12 | Is `GET /api/read/{id}` honest as a GET? (G5) | Phase 2 | keep GET, make it idempotent |

**#7 and #8 are coupled:** a public `/` with a signup path is a coherent product; a gated `/` with
signup isn't.

**#2 and #4 are the only ones blocked on you specifically.** Everything else has a workable default.

---

# 4. External services

| # | Service | For | Cost | Lead time | Status |
|---|---|---|---|---|---|
| 1 | **Cloudflare** | registrar · DNS · Pages · R2 | free / ~$10yr | hours | not started |
| 2 | **Twilio** | WhatsApp delivery, recovery, password reset | per message | minutes | not started |
| 3 | **Meta Business** *(via Twilio)* | business verification + 4 template approvals | — | **days–weeks** | not started |
| 4 | **Render** | Django + managed Postgres | **~$5–7/mo** | minutes | not started |
| 5 | **Anthropic** | the companion (Sonnet 5) | per token | minutes | not started |
| 6 | GitHub | source, CI | free | — | **live** |
| — | *Payment provider* | later | % per txn | **days–weeks KYC** | **undecided (#4)** |

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
