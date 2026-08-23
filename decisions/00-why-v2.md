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
