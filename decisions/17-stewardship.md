# Stewardship — how the owner runs it

D75–D80, D82–D86

Locked 2026-09-24 in one grilling session. The owner asked for: a good admin UI with full CRUD on
readers; books uploaded as a folder of PDFs, not chapter by chapter; video uploads; and a library
that shows books as covers, the way Audible does, not a list of PDFs.

**When:** built now, on `core/`, on the same terms D72 gave landing and the chamber. All logic
goes in services (a new `services/catalog.py`, plus additions to `onboarding.py`), so the rebuild
moves it in one piece (#138 `apps/catalog`, #137 `apps/identity`). It shares no files with cadence
(#112–#114), so the two tracks run in parallel.

**Issues:** #165 metadata + video (D76, D77) → #166 folder upload (D78) and #168 cover library (D79) ·
#167 admin shell + reader CRUD (D82, D80) → #169 reader dossier (D82).

---

## D75 — The admin is an upgraded Django admin, not a React admin

**Locked** 2026-09-24 · owner's call

> **Superseded by D82** (below), the same day: the admin moves into the app. The services D75
> asked for are unchanged; only the screens move.

### Decision

The admin UI stays in Django admin, with:

- a modern admin theme (django-unfold is the candidate; the choice is made in the issue),
- **custom admin views** for the things a model form does badly: *Upload a book* (D78) and
  *everything about this reader* (PLAN 7.1.4),
- **Add Reader** as a form in front of `onboarding.create_reader` (D26), never Django's default
  user form. The seam stays the only way a reader comes into existence.

Every admin action calls a service function. The admin views stay thin. This keeps the standing
rule, *anything a human can do in Django admin, a service function does.*

### Why

Readers are counted in dozens and admins in ones. Django admin already provides auth, permissions,
forms, list filters, search and CSRF. A React admin would have to rebuild all of that, plus about
fifteen staff-only endpoints and their schemas, in the same weeks the rebuild moves `core/` into
`apps/`.

### Rejected

- **A React admin at `/admin` in the SPA.** Full design control, about three times the work, and
  a second permission system for the same `is_staff` question.
- **A separate admin app at `admin.<domain>`.** A third origin, deploy and CI workflow, for one or
  two people.

### Revisit if

Someone who isn't technical runs content operations every day and finds the Django admin hard to
use even with the theme applied. The services are already there, so a React admin would only be a
new front on top of them.

---

## D76 — Video: one optional video per chapter, one public sample per book

**Locked** 2026-09-24 · owner's call · amends D19

> **Amended by D83:** a book also gets one owners-only video.

### Decision

- **`Chapter.video`**: optional. A companion to the chapter (commentary, a lecture), not a
  replacement for it. The chapter is still a PDF. The video unlocks, is delivered and is
  token-gated **with its chapter**, so it needs no access path of its own.
- **`Book.sample_video`**: optional, **public**. It plays from a *Sample* button on the book's
  card and the landing page, with no login and no grant. Its job is to sell the book (ACQUISITION),
  so it is not reading content.
- **D19 amended:** `Book` gains `author`, `description` and `cover`. D19 left them out because no
  screen rendered them. The library (D79) now renders all three, so D19's own test passes.

### Why

A video tied to a chapter uses the machinery that already exists: grants, delivery, expiry,
sanctuary. It needs no new access rule, and the one promise sentence still describes the product.

### Rejected

- **A chapter can *be* a video** (`kind: pdf | video`). Every chapter path would have to branch on
  kind: extraction, `page_count`, D73 rendering, the chamber. The companion would also have no
  text for a video chapter unless we transcribed it.
- **Book-level video only.** Too small: the owner wants video as content, not only as marketing.
- **Videos as their own item in the library.** That's a second product line, and the promise
  sentence would have to be rewritten.
- **Several samples per book** (a `BookSample` table). A new table and ordering UI for a set that
  almost always holds one item.

### Revisit if

A book arrives whose chapters really are videos. That is when `kind` becomes worth what it costs.

---

## D77 — Videos play from short-lived signed R2 URLs

**Locked** 2026-09-24 · amends **mandate 3** (*never expose a storage URL; always proxy*), for
video only

### Decision

- A **chapter video** URL is minted only after `grants.validate(token)` passes. It is a presigned
  R2 GET that lives about 2 hours, long enough to watch the whole video, since a player keeps making
  Range requests against the same URL.
- A **sample video** URL is minted the same way with no grant check. **The bucket stays private.**
  Public means anyone can get a URL, not that the file sits at a permanent public address.
- The `<video>` element plays directly from R2. **PDFs, page images and covers are still proxied**
  exactly as D73 describes. Only video is excepted.

### Why

Proxying video through Django keeps a gunicorn worker busy for the whole time someone watches.
On the free tier (D35), a handful of people watching at once would stop the API from answering
anything else. A signed URL still keeps what the mandate protects: nothing permanent is exposed,
and the storage vendor can still be swapped because the URL is minted in one service function.

### Costs accepted

**A signed URL can be copied and shared, or the file downloaded, while it is valid.** D73 closed
this hole for pages by burning a watermark into each image. Video gets no watermark and no DRM.
We accept this because the video is secondary to the chapter; the chapter is the product.

### Rejected

- **Proxy through Django with Range support.** Follows the mandate as written, and falls over at
  tens of people watching at once.
- **Cloudflare Stream.** Adaptive bitrate is a real benefit on the patchy mobile data people have
  when they open a WhatsApp link. But it would be a sixth external system (amends D16), cost about
  $5 per 1,000 minutes stored plus $1 per 1,000 minutes watched, and need its own upload
  integration.

### Revisit if

Videos stutter for readers on mobile data (→ Stream), or video becomes the valuable thing and
people start sharing it (→ Stream's signed tokens and watermarking).

---

## D78 — A book is uploaded as a folder: filename convention, then a preview

**Locked** 2026-09-24 · owner's call

> **Amended by D84–D86:** the flow is a draft workspace (D84), files go straight to R2 (D85),
> and the strict naming is replaced by auto-matching fixed by drag (D86). The goals stand:
> nothing reaches a reader until publish, and every mistake is visible before it matters.

### Decision

The admin picks a folder in the browser (`<input webkitdirectory>`), on the app's `/admin` Books
screen (D82). The folder follows a
convention:

```
01 - The Threshold.pdf        chapter 1
01 - The Threshold.mp4        its video, optional (same stem)
02 - Of Ink and Time.pdf
cover.jpg                     optional
sample.mp4                    optional, the public sample (D76)
```

1. The admin types what filenames can't carry: **title, author, description, price**.
2. A **preview table** shows the detected chapters: number, title, PDF, video. The admin can fix
   titles and order, and it lists anything that didn't match: unnumbered files, gaps, duplicates,
   a video with no PDF.
3. **Confirm** creates the book **unpublished** (`is_published=False`), then runs extraction and
   D73 page rendering for each chapter. Publishing stays a separate, deliberate action.

The whole import is one service function, `catalog.import_book(...)`, which the admin view and a
future management command both call.

### Why

No extra file to write for each book, and every mistake shows up before anything is saved. Because
the book is created unpublished, a half-finished import is never offered to a reader, which is the
reason `is_published` exists (D19).

### Rejected

- **A manifest (`book.yaml`) in the folder.** Precise, but every book needs a hand-written file,
  and a typo in it is a new way for an upload to fail.
- **A zip upload.** One huge request, unzipping in server memory, and the worst option for large
  video files.

### Revisit if

Books arrive in a form that doesn't follow the convention (e.g. one PDF that has to be split into
chapters). That would be a new importer, not a change to this one.

---

## D79 — The library is a cover grid: Home shelf and public catalogue share one BookCard

**Locked** 2026-09-24 · owner's call

### Decision

- **One `BookCard` component**: cover, title, author, plus whatever fits where it's shown.
- **Home is a shelf of owned books**, showing progress (D70). Tapping a book opens its chapter
  list, which is today's Home, one level down.
- **`/` becomes a catalogue grid** of published books, each with *Sample* (D76) and *Buy*.
- A book with no cover gets a **typographic cover** generated from its title and author, drawn in
  the D74 palette (PLAN S4.4). No book is ever shown as a blank square.

### Why

Readers who own two books currently get one long chapter list, and once a second book is
published there is nowhere to sell it (PLAN 1.1.4, "works; never exercised"). Covers are how people
recognise a book at a glance.

### Rejected

- **Home only.** Leaves the second book with nowhere to be sold.
- **Catalogue only.** Leaves readers with several books scrolling one long list.

### Revisit if

The catalogue grows past what a grid can browse (tens of books), and then it needs search and
categories.

---

## D80 — Removing a reader deactivates; erasing personal data is a separate action

**Locked** 2026-09-24

### Decision

- **Remove** sets `is_active=False`. They can't log in, their grants stop validating, no more
  deliveries. **Orders, grants, `MessageLog` and payment references stay.** It is reversible.
- **Erase personal data** is a second action that has to be chosen on purpose. It overwrites name,
  email and phone with placeholders and keeps the anonymised rows, for accounting and Razorpay
  reconciliation. It cannot be undone. This is the answer to a data-deletion request, which the
  legal pages (#121) will promise.
- Both are service functions in `onboarding.py`, and both leave a row (D63).

### Why

A hard delete cascades away payment history, which breaks refunds and reconciliation and goes
against D63. Deactivating alone gives no answer to someone who asks for their data to be deleted.

### Rejected

- **Hard delete.** Above.
- **Deactivate only.** No answer to a deletion request.

### Revisit if

A legal requirement asks for the financial rows themselves to be deleted, and that requirement has
to be weighed against the obligation to keep accounting records.

---

## Not decided — leaves for the issues

- **How large files reach R2.** Sending videos through a Django request may hit request-size and
  timeout limits on Render. The likely answer is a browser-to-R2 presigned PUT, with the admin view
  only confirming. Decide in the D78 issue, after measuring a real video.
- **Rendering time.** D73 renders every page at upload. A 20-chapter book may take longer than one
  request allows, so the import may need to be split into steps. Measure before designing.
- **The admin theme** (unfold or an alternative) and the dossier's exact contents.
- **Video formats**: MP4/H.264 only, with a size cap. Set it in the issue.

---

## D82 — The admin lives in the app, at `/admin`, with its own login page

**Locked** 2026-09-24 · owner's call · supersedes D75

### Why it changed

The owner's reason: an admin should not have to leave the product and open a second,
technical-looking application to run it. D75's own revisit clause, someone non-technical running
content every day, is that case arriving early.

### Decision

- **The admin is part of the SPA**, under `app.<domain>/admin`: Readers (list, add, edit,
  deactivate, erase), Books (list, edit, upload a folder), and each reader's dossier. Same
  components, labels and palette (D81) as the reader side.
- **`/admin/login` is its own page, with the same login behind it.** It calls the same
  `POST /api/auth/login` and gets the same session cookie (D6). An account that is not staff is
  refused on that page and never sees `/admin`. One login system, two doors: no second password
  store, no second session.
- **A staff-only API under `/api/admin/*`**, with a third auth class, `StaffAuth`: a session whose
  user is `is_staff`, CSRF-enforced like every session endpoint (D30). Ninja schemas on every body
  (mandate 4). `GET /api/auth/me` reports `isStaff` so the root machine can route.
- **Endpoints stay thin.** Every admin action is a service function: `onboarding.create_reader`
  (D26), the D80 deactivate/erase functions, `catalog.import_book` (D78). A React screen is a new
  front on the same services, which is what D75 asked of them.
- **The frontend follows D15:** `admin` is a page region of the root machine; each admin screen
  is a page machine with the 5-file split. The root machine learns one fact, whether the session
  is staff, and nothing about readers or books.
- **Django admin stays running, unlinked**, as a fallback for the owner alone. Nothing in the
  product points to it, and no workflow depends on it.

### Why a separate login page, recorded

The recommendation was one `/login` with an Admin link for staff. The owner chose a separate page.
Putting the same login endpoint behind it keeps the cost to one extra screen.

### Rejected

- **Upgraded Django admin (D75).** It means leaving the product to run it.
- **One `/login`, with an Admin link shown to staff.** The recommendation; the owner preferred a
  distinct entrance.
- **Staff land on `/admin` instead of Home.** The owner could no longer see what a reader sees
  from the same account.
- **A separate admin app at `admin.<domain>`.** Still rejected, for D75's reasons.

### Costs accepted

About three times D75's work: a staff API and its schemas, and React screens for each thing the
Django admin gave for free (tables, search, forms, file inputs, confirmations). #166, #167 and #169
are rewritten for this.

### Revisit if

The admin surface grows past what the reader app's shell holds comfortably (dozens of screens, many
roles). Then it becomes its own app, keeping the same `/api/admin/*`.

---

The four decisions below were locked together on 2026-09-24, in a second grilling session on the
owner's request: *create a book, then upload its PDFs one by one or as a whole folder, then add a
video for one chapter or for the whole book, all with a very good upload UI*, in the in-app admin
(D82).

## D83 — A book gets an owners-only video; one PDF is still one chapter

**Locked** 2026-09-24 · owner's call · amends D76

### Decision

- **One PDF is one chapter**, as today. Nothing about reading, pages (D73), progress (D70), the
  companion (D13) or delivery changes.
- **`Book.video`**: optional, **for owners only**, for example an introduction or overview of the
  whole book. It is a third kind of video beside the two in D76:

| Video | Who can watch | Served |
|---|---|---|
| `Chapter.video` | a live grant for that chapter | signed URL behind `WATCH` (D77) |
| `Book.video` | anyone who owns the book (`access.can_read`) | signed URL, session-authenticated |
| `Book.sample_video` | anyone | signed URL, public (D76) |

- Where a reader watches the book video is part of the library (#168, D79): the book's own page on
  the Home shelf. It is not delivered by WhatsApp.

### Rejected

- **A chapter holds several PDFs**, with a video for the group or one PDF. Every per-chapter
  system (the reader, page rendering, progress, the companion's text, delivery) would have to stitch
  several files together, for a structure no book has needed yet.
- **Per-chapter videos only, "complete" meaning a bulk upload.** The owner wants a video for the
  whole book as well. Bulk video upload is kept anyway, in D86.

### Revisit if

A book arrives whose chapters really are several documents each.

---

## D84 — Creating a book opens a draft workspace, not a wizard

**Locked** 2026-09-24 · owner's call · amends D78's flow

### Decision

1. **Create:** a short form (title, author, description, price, cover) creates the book
   **unpublished** and opens its workspace. The book exists from this moment.
2. **The workspace** is one screen per book with four sections, each showing its own state:
   - **Details:** the form above, editable.
   - **Chapters:** *drop a folder* **or** *add a PDF*, both feeding **one list**. Each row shows its
     progress through **uploading → rendering pages → ready**, or **failed** with a retry. Titles
     are editable in place, and rows reorder by drag.
   - **Videos:** a *Book video* slot (D83), a *Sample* slot (D76), and a slot per chapter.
   - **Publish:** a checklist (at least one chapter, every chapter *ready*, a cover). Publish stays
     disabled until the checklist is clear, and it is a separate, deliberate action (D19).
3. **Every upload saves the moment it lands.** Leave mid-upload and come back: what finished is
   there, and what didn't shows as failed with a retry. Editing a published book uses the same
   screen.

### Constraints this creates

- **Chapters reorder and delete only while the book is unpublished.** Once readers own it, grants
  and progress point at chapters, and cadence schedules by position. On a published book the order
  is fixed and a chapter with grants cannot be deleted. A chapter's PDF or video can still be
  replaced, which re-renders its pages.
- The workspace is a page machine (D15). Each upload is work in flight beside the page, so uploads
  are a **parallel region**, one entry per file (D42), never `useState`.

### Rejected

- **A step-by-step wizard.** Guided for the first book, but editing later needs a second screen
  anyway, and a wizard holding hundreds of megabytes until its last step loses them all on a
  refresh.
- **One long form with a Save button.** Upload status competes with form fields, and it gets
  unwieldy past about ten chapters.

---

## D85 — Uploads go straight to R2 on signed per-file URLs

**Locked** 2026-09-24 · settles the "how large files reach R2" leaf left open in D78

### Decision

For every file, PDF or video:

1. **Ask:** `POST /api/admin/uploads` (StaffAuth, D82) with the file's name, size, type and its
   destination (a chapter's PDF or video, or the book's cover, video or sample). The API checks type
   and size (MP4 only for video, `VIDEO_MAX_MB`, D76) and returns a short-lived **signed upload
   URL** for a fresh storage key.
2. **Send:** the browser sends the bytes **directly to R2**, with a live progress bar. Files over
   ~50 MB use **multipart upload** in chunks, so a dropped connection retries one chunk, not the
   whole file.
3. **Confirm:** `POST /api/admin/uploads/{id}/complete`. The API checks the object exists and has
   the size it was promised, attaches it to its destination, and for a PDF runs extraction and D73
   page rendering, **one chapter per request**.

- **Without R2 configured** (a fresh clone, tests), step 2 uploads to the API instead. Same three
  steps, same screens (mandate 6).
- **One-time setup:** a CORS rule on the bucket allowing `PUT` from the app's origin. It goes in
  `docs/RUNNING.md` beside the rest of the R2 setup.
- A signed *upload* URL is not a read URL and exposes nothing (mandate 3). It is still never
  logged (D22).

### Why

Django never holds a 500 MB body, so Render's request size and time limits stop mattering. The
progress bar is real because the browser is the one sending, and rendering stays one chapter per
request, so a 20-chapter folder is 20 small jobs.

### Rejected

- **Everything through the API.** One path, but a large video keeps a worker busy for minutes on the
  free tier, risks the request timeout, and cannot resume.
- **PDFs through the API, videos direct.** Right for each type, but two upload paths to build and
  keep working.

### Revisit if

R2 is replaced by a host without presigned uploads, or videos move to Cloudflare Stream (D77's
revisit clause), which has its own direct-upload API.

---

## D86 — Dropped files auto-match to chapters, fixed by drag

**Locked** 2026-09-24 · owner's call · amends D78's strict naming convention

### Decision

- **A dropped folder of PDFs** becomes chapter rows in this order: the number in the filename if
  there is one (`ch1_…`, `Chapter 2 - …`, `10 Return`), otherwise natural name order
  (`Chapter 2` before `Chapter 10`). The title is cleaned from the filename: number, separators and
  extension removed, underscores turned into spaces. Every title is editable and every row
  draggable. Non-PDF files in the folder are listed and skipped, never silently lost.
- **A dropped batch of videos** matches chapters by number, then by name. A video that matches
  nothing, or matches ambiguously, waits in a **tray**, and is dragged onto a chapter or onto the
  *Book video* slot. `sample.mp4` goes to the Sample slot.
- **Each row still has its own *Add PDF* / *Add video***, which is the one-by-one path.
- A match only proposes. Nothing uploads until the admin confirms the list, so a wrong guess costs
  one drag.

### Rejected

- **Strict naming (D78 as written).** Predictable, but every real folder has to be renamed first.
- **Manual assignment only.** Never guesses wrong, but dragging 40 files for a 20-chapter book is
  exactly the tedium this feature exists to remove.

### Revisit if

Guesses are wrong often enough that fixing them takes longer than naming files would.
