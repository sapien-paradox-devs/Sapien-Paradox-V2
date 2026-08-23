# Status — what we have, what we need to do

> Current state and open work. Changes every session.
>
> **Decisions are not here.** `decisions/` holds every locked decision with its reasoning, indexed
> in `decisions/README.md`. **What we're building is not here either** — that's `DESIGN.md`.
> This file tracks state and actions only.
>
> **This is not a diary.** V1's equivalent accumulated a 24-entry narrative log nobody could use.

**Last updated:** 2026-08-12

---

# 1. What we have

## Documents (6 files, ~1,900 lines)

| File | Holds |
|---|---|
| `CLAUDE.md` | how to work here — stack, seams, mandates |
| `DESIGN.md` | product, scope, architecture, data model, roadmap |
| `decisions/` | **24 locked decisions** with rationale, rejected alternatives, V1 provenance |
| `apps/api/CLAUDE.md` | backend layering, file structure, API surface, V1 pitfalls |
| `apps/web/CLAUDE.md` | frontend levels, root machine spec, XState conventions, V1 pitfalls |
| `decisions/00-why-v2.md` | the V1 audit every decision traces back to |

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
  Proposed answers in `apps/api/CLAUDE.md`; none locked.
- **Rate-limit mechanism** — four limits specified, no Redis (D17). Derivable from `MessageLog` and
  `PasswordResetToken` rows, but undecided.
- **`.env.example`** — the variable list falls out of the above.
- **Level 3 detail** — copy, validation, animation, prompt craft. Deferred by decision.

## Code

None, except `apps/web/src/pages/machine/{machine,types}.ts` — written during design as the
reference shape.

## Version control

**Nothing is committed.** `git init` only, no remote. Twenty-four decisions across six documents,
untracked — the exact failure that lost V1's planning tree.

---

# 2. What we need to do

## Track A — start the clock *(calendar time; cannot be compressed)*

- [ ] **Register the domain** on Cloudflare — everything downstream embeds it
- [ ] **Finalise the four WhatsApp template copies** — chapter delivery, fresh link, unread
      reminder, password reset
- [ ] **Twilio account** → WhatsApp sender application → **submit all four templates**
- [ ] **Decide the payment provider**, then start KYC — *blocked on an open question, see §3*

**Nothing here has started.** Meta approval is days-to-weeks of waiting and gates the Phase 4 demo.

## Track B — close the design gaps *(unblocks all backend code)*

- [ ] **Grill the three seams** — two or three questions each
- [ ] Close the four API-layer questions
- [ ] Decide the rate-limit mechanism
- [ ] Enumerate `.env.example`

## Track C — build *(after Track B; implemented against the specs)*

- [ ] **Phase 0** — monorepo, Django + Ninja, `DATABASE_URL`, `django-storages`, Vite + React +
      XState, `labels.ts`, `shared/constants.json`, path-filtered CI, **both sides deployed**
- [ ] **Phase 1** — auth endpoints, `/login` + machine, boot rehydration, cross-subdomain cookie
- [ ] **Phase 2** — 8 models + migrations, the three seams, `GET /api/home`, `/read/:chapterId`,
      Home screen, Django admin onboarding, `seed_dev`
- [ ] **Phase 3** — grant + PDF endpoints, `/r/:token`, sanctuary, 7-day expiry
- [ ] **Phase 4** — Twilio + console backends, `MessageLog`, admin action, CLI, re-issue
- [ ] **Phase 5** — `text_content` extraction, `POST /api/chat`, caps, panel, versioned prompt
- [ ] **Phase 6** — end-to-end test, complete seed, `docs/HOW_TO_START.md`

Tracks A and B run concurrently. Phases 3 and 4 run in parallel after Phase 2.

## Housekeeping

- [ ] **Commit everything** — six documents, untracked
- [ ] Push to GitHub? (`sapien-paradox-devs`, new repo) — your call

---

# 3. Open questions

| # | Question | Blocks | Default if unanswered |
|---|---|---|---|
| 1 | **Message template copy** (4 templates) | **Meta approval → Phase 4 demo** | I draft in `BUSINESS.md` register for review |
| 2 | **Domain name** | Track A entirely — templates embed the URL | — must be chosen |
| 3 | Hosts confirmation | Phase 0 | Cloudflare Pages + Render + managed Postgres + R2 (D23) |
| 4 | **Payment provider** — Stripe vs Razorpay/Cashfree | KYC clock | **needs: where is the business registered, and where are the readers?** |
| 5 | Companion interaction design + system prompt | Phase 5 | its own session (D14) |
| 6 | Read/unread mark on Home — keep or drop | Phase 2 | keep (D11) |
| 7 | **What does an anonymous visitor see at `/`?** Amends D7/D11 | Phase 2 | redirect to `/login` |
| 8 | **Is a signup page in scope?** Contradicts D10 | Phase 1 | no — D10 stands |
| 9 | PDF endpoint name — `/api/grants/{token}/pdf` vs V1's stale `/api/shards/stream/` | Phase 3 | rename (`Shard` no longer exists) |
| 10 | CSRF policy | Phase 1 | enforce on session endpoints, exempt grant-authenticated |
| 11 | Where chat caps live | Phase 5 | `services/companion.py` |
| 12 | Is `GET /api/read/{id}` honest as a GET? | Phase 2 | keep GET, make it idempotent |

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
| 6 | GitHub | source, CI | free | — | exists |
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
