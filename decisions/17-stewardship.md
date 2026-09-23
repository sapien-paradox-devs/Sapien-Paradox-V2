# Stewardship — how the owner runs it

D75–D80

Locked 2026-09-24 in one grilling session. The owner asked for: a good admin UI with full CRUD on
readers; books uploaded as a folder of PDFs, not chapter by chapter; video uploads; and a library
that shows books as covers, the way Audible does, not a list of PDFs.

**When:** built now, on `core/`, on the same terms D72 gave landing and the chamber. All logic
goes in services (a new `services/catalog.py`, plus additions to `onboarding.py`), so the rebuild
moves it in one piece (#138 `apps/catalog`, #137 `apps/identity`). It shares no files with cadence
(#112–#114), so the two tracks run in parallel.

---

## D75 — The admin is an upgraded Django admin, not a React admin

**Locked** 2026-09-24 · owner's call

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

### Decision

The admin picks a folder in the browser (`<input webkitdirectory>`). The folder follows a
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
