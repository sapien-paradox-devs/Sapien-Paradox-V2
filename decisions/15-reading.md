# Reading — progress and the chamber's renderer

D70, D71, D72, D73

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

**Superseded by D73** (2026-09-23), before it shipped. pdf.js needs the PDF in the browser, and
the owner wants chapters that cannot be copied, printed or downloaded. The reasoning below
about *why the native viewer had to go* still stands; only the replacement changed.

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

---

## D73 — Pages are rendered on the server; the PDF never reaches the browser *(supersedes D71 and D29)*

**Locked** 2026-09-23 · owner's call

### The requirement

Chapters must be **non-copyable, non-printable and non-downloadable**, like a Kindle book in a
browser. A browser cannot make that absolute: a screenshot or a phone camera always works. What
can be decided is whether the *file* and the *text* ever leave the server. With pdf.js (D71) they
do, and anyone with developer tools can save the PDF from the network tab. So they must not.

### What

- **Each page is rendered to an image on the server** with `pypdfium2`, as WebP, 1400px wide,
  **once, at upload**: from the admin save, `seed_dev`, and a `render_chapters` command for
  existing chapters. It is an explicit call, never a signal (D19). The images live in private
  storage beside the PDF. Each page's size and the PDF's outline (sections, via `pypdf`) are
  stored on `Chapter`, so the reader can lay out and navigate without the file.
- **The API serves images, never the PDF.** `GET /api/grants/{token}/pages` returns the layout
  (page sizes and sections), and `GET /api/grants/{token}/pages/{n}` returns one page image. Both
  are grant-authenticated and refuse exactly as the grant endpoints do (410 expired, 403 not
  owner). **`GET /api/grants/{token}/pdf` is removed**: while it exists, anyone holding a link
  holds the file. *Supersedes D29.*
- **Every page is watermarked as it is served** with the reader's name and masked phone
  (`Ada Demo · +91 ******3210`: asterisks, because the watermark font has no bullet glyph), very faint and diagonal, burned into the image. A shared
  screenshot then carries its source. Rendering is per request (tens of milliseconds a page), so
  nothing per-reader is stored.
- **In the browser:** pages are images loaded through `fetch` into blob URLs; there is no text
  layer. Right-click and drag are blocked on the pages; printing shows a line saying printing is
  not available instead of the chapter; Ctrl/Cmd+P and Ctrl/Cmd+S are intercepted in the chamber.
  Responses are `Cache-Control: private, no-store`.
- **Unchanged:** the companion still reads `text_content` on the server (D13). The sections
  drawer, the progress line (D70) and the threshold ceremony all work the same over images.

### The honest limit

Screenshots and photos cannot be prevented by any web page. The watermark is the answer to them:
it does not stop a copy, it makes one traceable, which is what discourages sharing.

### Rejected

- **pdf.js plus browser-side blocks** (the half-built #150). It stops casual copying, but the PDF
  still crosses the network intact.
- **Encrypted PDFs.** The browser needs the key to open them, so the key travels with the file.
- **Browser DRM (EME).** Built for video streams, not pages of a book, and it needs a licensed
  content-decryption module.
- **Pre-rendering a watermarked copy per reader.** Storage grows with every reader times every
  page, and a copy has to be made again whenever a reader's details change.
- **Watermarking in the browser (CSS over the image).** Free to remove with developer tools.
  Burning it in server-side costs a little CPU and cannot be removed.

### Costs accepted

A new dependency (`pypdfium2`, prebuilt wheels, no system libraries), rendering time at upload,
image storage beside each PDF, more bandwidth than a PDF, and CPU per page view for the watermark.

### Also fixed

The admin save did not run text extraction at all. `Chapter`'s docstring said it did, and only
`seed_dev` called it, so a chapter uploaded through admin gave the companion nothing. Rendering
and extraction now run together from the admin save.
