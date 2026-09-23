# CLAUDE.md — Sapien Paradox V2

## What this is

A modular, cadence-paced learning platform for "Intellectual Explorers." A reader buys a book;
its chapters unlock on a schedule; each arrives by WhatsApp as a self-authenticating link; they
read it in a token-gated chamber and discuss it with a companion.

**V2 is the same product as V1, rebuilt so every piece is deliberate.**

**V1 is the parent repo:** `../Sapien Paradox App` (github: `Sapien-Paradox-App-Services` +
`-UI`). It is **read-only reference** — consult it for prior art and provenance, never plan or
build there. V1's models, tickets, open PRs and test failures are **not constraints on V2**;
V2 inherits nothing but the product idea and the lessons.

Every session starts by asking whether the work is for V1 or V2 (enforced by
`.claude/hooks/session-start.sh` in both repos). If the answer is V1, switch directories.

## Read first

These three are **imported automatically** — they are already in context, do not re-read them
with a tool call:

@STATUS.md
@DESIGN.md
@decisions/README.md

Loaded on demand, when the work touches them:

| File | When |
|---|---|
| `decisions/NN-*.md` | the full text of a decision the index says is relevant |
| `apps/api/CLAUDE.md` | working on the backend (auto-loads in that directory) |
| `apps/web/CLAUDE.md` | working on the frontend (auto-loads in that directory) |
| `docs/ACCOUNTS.md` | external services, credentials, client handover |
| `docs/RUNNING.md` | running locally or deploying |

**Most structural questions are already decided.** `decisions/README.md` — imported above —
indexes every one by number with rejected alternatives and V1 provenance. Check it before
proposing: the option you are about to suggest may already have been considered and ruled out
for a recorded reason.

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

- **`access.can_read(user, chapter) -> bool`** — the only access check. Never query `Order` or
  `TemporalGrant` directly. Token liveness is a separate question: `grants.validate(token)`.
- **`onboarding.create_reader(...)`** — the only way a reader comes into existence.
- **`whatsapp.send_chapter(grant)`** — the only chapter delivery path. Callers mint the grant.

Signatures, failure behaviour, and transaction boundaries: **D25–D27** in
`decisions/07-seams.md`.

*Anything a human can do in Django admin, a service function does.*

## Engineering mandates

1. **Zero hardcoded strings** — UI text via `labels.ts`; message templates and the companion
   prompt in their own config files, editable without touching logic.
2. **Machine-first logic, on both sides.** The flow lives in machines; nothing else decides.
   - **Backend:** any action on a subject that has a machine (a grant, a purchase attempt, a
     message) is an **event dispatched to that machine**. Guards decide, actions call services
     through `ctx.deps`, and the endpoint only maps the result to a status. An endpoint never calls
     a service to perform a flow step, and never dispatches one event to borrow its checks for
     another. Checklist: `apps/api/CLAUDE.md`, *Adding behaviour*.
   - **Frontend:** anything that calls the API, waits, retries, or has more than two states is an
     XState machine with the 5-file split; work that runs alongside a page is a **parallel region
     of that page's machine** (D42). Hooks only measure the DOM or subscribe to browser events and
     hand the result to a machine as an event. Checklist: `apps/web/CLAUDE.md`, *Hooks or a machine*.
3. **Temporal security** — never expose a storage URL; always proxy bytes through the API.
4. **Type-safe API** — Ninja schemas on every request/response body; no untyped dicts at the
   boundary, no `as any` on the frontend.
5. **Variable Velocity** — animations start fast, settle slow.
6. **Env-driven externals** — anything touching the outside world reads env and has a
   console/no-op fallback. A fresh clone runs with zero credentials.

## Workflow — issue first, then a branch, then a PR

**No work starts without a GitHub issue.** If there isn't one, stop and ask for it — don't open
one unilaterally and don't start coding "just this once".

```
issue  →  branch  →  one PR  →  merge  →  issue closes
```

- **One issue, one PR, one branch.** Never two issues in a PR, never one issue across two PRs.
- **Branch name carries the issue:** `<issue-number>-<short-slug>`, e.g. `14-grant-pdf-stream`.
- **The PR body says `Closes #<n>`**, so merging closes the issue and the trail survives.
- **A PR is a vertical slice** — schema, API, UI, tests — spanning both apps when the change does.
  That is the whole reason this is a monorepo (D6).
- **Never commit code straight to `main`.**

**Markdown is exempt.** Decision records, specs, `STATUS.md`, this file — write them directly and
commit them. Decisions must land the moment they're made (sessions end abruptly), and routing a
paragraph through an issue and a PR would guarantee they don't.

*Also exempt: repository bootstrap, which cannot be gated behind an issue that has nowhere to
live yet.*

## Working discipline

- **BFS** — root before leaves, exhaust a level before descending. One question at a time, always
  with a recommended answer.
- **Decisions land immediately** in `DESIGN.md`, not at end of turn. Sessions end abruptly.
- **Every departure from V1** carries an `Inherited from V1` block: what V1 did, what V2 does,
  why, what would make us revisit.
- **One canonical doc per question.** If a new doc would overlap an existing one, edit the
  existing one. V1 had three docs answering "what are we building" and they drifted apart.
- **Simple over fancy.** Complexity must earn its keep.
