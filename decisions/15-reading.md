# Reading — progress and the chamber's renderer

D70, D71, D72

---

## D70 — Reading progress, shown quietly *(reverses D11's "no progress bars")*

**Locked** 2026-09-23 · owner's call

### What changes

D11 said Home shows *"no progress bars, percentages, or badges — they fight the product's
restraint"*, and `BUSINESS.md` locked the chamber as *"no timers, no progress bars"*. **Both are
reversed for reading progress, and only for that.** A reader wants to know how far into a chapter
they are and which chapters they have finished. Hiding that was restraint at the reader's expense.

**Quiet, not explicit.** The owner chose this over an always-on labelled bar:

- **In the chamber:** a 2px sienna hairline along the top edge fills as the reader moves through
  the chapter. It fades with the rest of the chrome (5.2.4) and comes back on movement. No number,
  no "page 3 of 7".
- **At the end of the chapter:** a *Mark chapter complete* action. **Only this makes a chapter
  100%.** Scrolling to the last page reaches at most 99%. Completion is something the reader
  declares, not something the page infers.
- **On Home:** a small ring per chapter showing its percentage; *Completed* with a check at 100%;
  a total per book.

**Still forbidden:** timers, reading speed, streaks, "you're behind", nudges, and any badge or
reward for finishing. Progress describes where the reader is; it never judges it.

### How it is stored

A ninth table, **`ReadingProgress`**: `user`, `chapter` (unique together), `furthest` (0–1,
only ever increases), `completed_at` (nullable), `updated_at`. *Amends D18's eight tables.*

- **Keyed on (user, chapter), not on the grant.** A re-issued link (D9) is a new grant, and the
  reader's place must survive it. A token-only reader writes through `grant.user`, so progress
  works without a session.
- **`furthest`, not the current position.** Scrolling back to reread does not lose progress.
- **Writes are throttled on the client** (on settle, and at most every few seconds) and are
  idempotent on the server: `furthest = max(stored, sent)`, capped at 0.99 until complete.

### The constraint it must not break

`DESIGN.md` §3.5: *"Unlocks are schedule-driven, never read-completion-driven."* **Nothing in
cadence, access, or delivery may read `ReadingProgress`.** A reader who never marks anything
complete still gets every chapter on schedule. If a future feature wants to gate on completion,
that is a new decision, and a reversal of the product's premise.

### Rejected

- **Explicit, always-on bar with page numbers.** Clearer, but it pulls the eye while reading,
  and the chamber's whole promise is that nothing does.
- **Home only, nothing in the chamber.** The closest to the original rule, but it leaves the
  reader guessing where they are inside a long chapter.
- **Inferring completion from reaching the last page.** It marks a chapter done for someone who
  skimmed to the end to see how long it was.
- **Storing progress on `TemporalGrant`.** It is lost on every re-issue.

---

## D71 — The chamber renders the PDF itself, with pdf.js *(reopens the #31 departure)*

**Locked** 2026-09-23 · follows from D70

### Why

The chamber has shown the chapter through the browser's own PDF viewer (`<object>`). That viewer
is a black box: the page cannot know the reader's position, cannot offer section navigation, and
cannot be styled or themed. D70's progress, and the section navigation the owner asked for, are
both impossible with it. #117 showed it *renders* on phones; it did not show it can do anything
else.

### What

- **`pdfjs-dist` directly, not `react-pdf`.** One dependency, no wrapper. The worker is
  lazy-loaded on the reader route only, so no other page pays for it.
- **Bytes still come through the API proxy** (`GET /api/grants/{token}/pdf`, D29). Nothing about
  mandate 3 changes; pdf.js is handed the bytes, not a storage URL.
- **Pages render lazily** as they approach the viewport, at the device's pixel ratio, fitted to
  width. A text layer is kept so text stays selectable and a later highlights feature has
  something to anchor to.
- **Sections come from the PDF's own outline (bookmarks)** when it has one. Word and Google Docs
  create them from headings on export. When a PDF has no outline, the drawer lists pages instead.
  No heading detection from `text_content`: guessing structure is how a table of contents ends up
  wrong.
- **The page gets the site's theme.** In dark mode the page is dimmed, not inverted: inversion
  wrecks images.

### Inherited from V1 / from #31

**Before:** #31 chose the native viewer over `react-pdf` to avoid a dependency, and that was
right while the chamber only needed to show the pages.
**Now:** pdf.js, because progress and navigation need the reader's position.
**Revisit if:** browsers expose scroll position from their built-in viewer (they do not), or
chapters stop being PDFs.

---

## D72 — This work proceeds on the current structure *(amends structure-D67)*

**Locked** 2026-09-23 · owner's call

Structure-D67 (`14-structure.md`) says the rebuild lands before the surface track's remaining work.
**For the idea-led landing page, the pdf.js chamber (D71) and reading progress (D70), the owner
chose to build now, on `core/`**, rather than wait for #128–#147.

**Consequences, stated so the rebuild can absorb them:**

- `ReadingProgress` is born in `core/models.py`. Rebuild PR A (#136, D68) therefore moves
  **nine** models, not eight. `ReadingProgress` belongs in `apps/reading`, beside `TemporalGrant`.
- The two new grant endpoints (`/progress`, `/complete`) live in `core/api/grants.py` and move
  with it in Rebuild 13 (#140).
- The frontend parts touch nothing the rebuild moves.

**Rejected:** *frontend now, backend after the rebuild.* It keeps structure-D67 whole, but it
leaves "Mark complete" with nowhere to write for weeks, and the owner wants the feature whole.

**Revisit if** the rebuild starts before this work merges. Then `ReadingProgress` should be
written straight into `apps/reading` instead.
