# Session artifacts — 29–30 Aug 2026

Everything published during the session that designed and built the machine layer. Private
pages on claude.ai; the links are clickable.

**Read order, if you are starting cold:** the two architecture reports, then the walkthrough for
whichever issue you are touching. The four-doc shortlist at the bottom is the fastest path.

---

## 1. Architecture — the whole shape

Read these first. Each covers one side end to end.

| Doc | Covers |
|---|---|
| ⚙️ [The Machine Spine](https://claude.ai/code/artifact/46641ea7-45a5-4a19-b3a8-7ab14f92b68a) | Backend: machines as the orchestration layer, five transition tables, the dispatch contract, how it fits D25–D27, and D36–D40 |
| 🪟 [The Screen Spine](https://claude.ai/code/artifact/c3238ea9-48a5-47b3-916f-96c7f3416009) | Frontend: the parallel-region root machine, four page machines, two component machines, and where the two spines meet |

---

## 2. Per-issue walkthroughs

One per implemented issue. Same shape throughout: **why → what (with a diagram) → how (files) →
gotchas**. The gotchas record what actually went wrong while building.

### Backend

| Issue | Doc | The point |
|---|---|---|
| #18 | 📐 [Amending the Layering](https://claude.ai/code/artifact/701186dc-0449-4aa4-bd9e-1c26905470bc) | Why a fourth layer, and D36–D40 |
| #19 | ⚙️ [Dispatch and Binding](https://claude.ai/code/artifact/ea0a6180-5ce4-4840-ab81-27905cb5e322) | The framework every machine plugs into |
| #20 | 🔑 [The Reading Machine](https://claude.ai/code/artifact/0c82aa20-f52a-4a7c-8a94-0983e3f8aac2) | A grant's life; why expiry is derived, not stored |
| #21 | 📨 [The Delivery Machine](https://claude.ai/code/artifact/917b83d7-df5b-4e0c-80a2-5625a49cb327) | D27's retry policy as three rows |
| #22 | 🪪 [Auth and Onboarding](https://claude.ai/code/artifact/99d780ea-c610-4e6e-825d-0a187ef6f538) | **The row-order bug the table caught** |
| #24 | 🗺️ [Diagrams From the Tables](https://claude.ai/code/artifact/f43680eb-2581-4460-b83f-b821ee7c1990) | Generated Mermaid, no dependency |

*#23 (the `purchase` machine) has no doc — it was deferred because it conflicts with D19's
"no speculative payment columns". The reasoning is on the issue.*

### Frontend

| Issue | Doc | The point |
|---|---|---|
| #25 | 🧭 [Naming the Failures](https://claude.ai/code/artifact/3d70285c-3536-4b79-b076-9eb82da68b04) | D41–D45 |
| #26 | 🔌 [The Single Funnel](https://claude.ai/code/artifact/79a430bd-383f-460e-8db5-974a7b2e79ad) | `fetcher.ts`, and adding a test runner |
| #27 | 🪟 [The Root Machine](https://claude.ai/code/artifact/8b17539f-db93-4df8-98fb-b1e1174949dd) | Parallel regions; two conventions had to change |
| #28 | 🔐 [The Login Page](https://claude.ai/code/artifact/8c45f176-643e-4e83-b1e2-4f17585ef3c5) | Two failures told apart; two typing traps |
| #29 | 📚 [The Home Page](https://claude.ai/code/artifact/34f590b9-962b-4aeb-be64-4904ff773002) | Two regions; the `as const` trap |
| #30 | ⏳ [The Opening Page](https://claude.ai/code/artifact/afc3abcc-e98c-47c3-a716-fcfaed4af481) | **The refresh-only bug `waiting` prevents** |
| #31 | 📖 [The Reading Chamber](https://claude.ai/code/artifact/eb637734-40dd-4246-9bd5-28374f189a61) | Three failure screens; no `react-pdf` |
| #32 | 💬 [The Companion Panel](https://claude.ai/code/artifact/ee752f8f-69bd-4a0e-bbd7-3ea9a44b0416) | Silent until opened; caps as boundaries |

---

## 3. V1-era, superseded

Written before the session established that V2 was the active rebuild. Kept because the
external-service facts in them are real and still true.

| Doc | Still useful for | Superseded by |
|---|---|---|
| 🗺️ [Sapien Paradox Launch Path](https://claude.ai/code/artifact/25cd86c9-e37c-4082-b067-0b98cad3fd0e) | The external-services picture and lead times | V2's `STATUS.md` and `docs/ACCOUNTS.md` |
| 🔑 [Temporal Grant Anatomy](https://claude.ai/code/artifact/d090b840-75d2-476f-a265-ff45596d5ea4) | How a grant works, conceptually | D21 and the #20 walkthrough — it describes **V1's** model, including the `Shard` table D4 deleted |

**Do not take the data model in *Temporal Grant Anatomy* as current.** It documents V1.

---

## 4. If you only read four

1. **#19 Dispatch and Binding** — nothing else makes sense without it
2. **#22 Auth and Onboarding** — the bug the tables caught; the strongest argument for the approach
3. **#27 The Root Machine** — why the frontend is shaped the way it is
4. **#30 The Opening Page** — the subtlest bug in the frontend

---

## 5. Two calls worth a second opinion

Both departed from the signed-off architecture during implementation, and both are argued in
their walkthroughs rather than buried:

- **Expiry is not a state** (#20). The report had `expired` as a fourth terminal state; building it
  showed expiry is derived from `expires_at`, and storing it too would need a sweeper.
- **No `react-pdf`** (#31). The chamber fetches proxied bytes and renders from a blob URL. V1 used
  `react-pdf`, so this is a genuine change.

---

*Other Sapien Paradox artifacts exist from earlier sessions — the deploy runbook, the build order,
Render setup. Run `/artifacts` in Claude Code to list everything, or browse
[the gallery](https://claude.ai/code/artifacts).*
