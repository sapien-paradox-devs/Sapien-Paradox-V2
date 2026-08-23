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
