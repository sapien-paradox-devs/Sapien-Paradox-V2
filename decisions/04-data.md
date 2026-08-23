# Data model

D4 · D18 · D19 · D21

```
User ──< Order >── Book ──< Chapter ──< TemporalGrant >── User
                                 │
                            (PDF file, text_content)
MessageLog >── User, TemporalGrant
ChatUsage  >── TemporalGrant
PasswordResetToken >── User
```

---

## D4 — Four departures from V1's domain model

**Locked** 2026-08-08

**`Shard` entity**
- **V1 did:** `Chapter.shard = OneToOneField(Shard)`; `Shard` held title, slug, file.
- **V2 does:** the file lives on `Chapter`. No `Shard` table. "Shard" survives as product
  vocabulary in the UI, not as a table.
- **Why:** strictly 1:1 — the join bought nothing.
- **Revisit if:** a PDF is shared across books, or a chapter needs multiple files.
- **Follow V1?** ☐ yes ☑ no

**View quota**
- **V1 did:** `max_views = 5` / `current_views`, enforced in `is_valid()`.
- **V2 does:** removed.
- **Why:** appears in no V1 plan document — it arrived in code and was never specced. As written,
  a reader who opens a chapter six times is locked out of a book they paid for. Time-bounded
  access is the product concept; view-counting is a harsher one nobody chose.
- **Revisit if:** anti-sharing enforcement on grant links is ever needed.
- **Follow V1?** ☐ yes ☑ no

**`pace` location** — unchanged, stays on `Order`. A reader may read one book slowly and another
quickly, and it keeps the cadence anchor (`Order.created_at` + pace) in a single row.
**Follow V1?** ☑ yes

**`TemporalGrant.user` nullability**
- **V1 did:** nullable — a leftover from the pre-auth era of anonymous grants.
- **V2 does:** required. Every grant belongs to someone; nullable FKs breed `if grant.user:`
  branches forever.
- **Follow V1?** ☐ yes ☑ no

---

## D18 — Eight tables

**Locked** 2026-08-09

`User` · `Book` · `Chapter` · `Order` · `TemporalGrant` · `MessageLog` · `ChatUsage` ·
`PasswordResetToken`. (Django's own — sessions, admin log, content types, permissions — are not
designed here.)

**`PasswordResetToken` is separate from `TemporalGrant`, not a generic token table.** The
lifecycles differ — a grant is multi-open and lives 7 days; a reset token is **single-use** and
lives about an hour. A generic `Token` with a `purpose` column accumulates `if purpose ==` branches
and serves neither well.

**`ChatUsage` is a real table, not a cache counter** — there is no Redis (D17), it survives
restarts, it is visible in admin, and a counter alone cannot tell you *which* grant burned the
budget after the fact.

**`ChatUsage` never stores message content.** Counts and token usage only. Storing conversations
would help prompt work, but it means retaining private reading-room conversations on a product
whose pitch is quiet, unmonitored reading, and it creates a data-protection obligation that does
not otherwise exist. If conversation data is later wanted, that becomes an explicit opt-in decision
rather than something that quietly accumulated from day one.

---

## D19 — `User`, `Book`, `Chapter`, `Order`

**Locked** 2026-08-09

### `User`
`email` (unique, `USERNAME_FIELD`) · `password` · `full_name` (single field) · `phone` (**unique**,
required, E.164) · `is_staff` / `is_active` / `date_joined` (inherited).

- **`role` dropped.** V1 carried `role` *and* Django's `is_staff`/`is_superuser` — two systems
  answering one question, set together in `create_superuser`, free to drift. Django admin gates on
  `is_staff`, and D10 says admin *is* Django admin, so nothing consumes a domain `role`.
  **Follow V1?** ☐ yes ☑ no
- **`phone` is now unique.** V1 validated format but not uniqueness — survivable when phone was
  only a delivery address, not now that it is the **account-recovery channel** (D16). Two accounts
  sharing a number makes "send me a reset link" ambiguous.
- **`email` stays the login field** — it is what people expect to type. Worth noticing it has
  become the least load-bearing field on the record.
- **Timezone deferred** — a nullable field and one migration whenever cadence needs civilised send
  hours; adding it now would be guessing at the format.

### `Book`
`title` · `slug` (unique) · `price_cents` (kept; payments return per D1) · `is_published` (default
`False`) · `created_at`.

- **`is_published` is new.** Concierge onboarding works against a live database, so without it a
  half-built book with three of eight chapters is immediately assignable.
- **Nothing else yet** — no author, description, or cover until a screen renders them. Fields
  nobody displays are how V1 acquired its unspecced view quota.

### `Chapter`
`book` (FK) · `order_index` (1-based) · `title` · `file` · `text_content` (nullable) · `page_count`
(nullable). `unique_together (book, order_index)`, `ordering = ["order_index"]`.

- **Extraction is explicit, never a signal.** `services/extraction.py` is called by the admin save
  and by `seed_dev`. A `post_save` signal hides a 40-page PDF parse behind an innocuous `.save()`
  — a surprise found only in production. Explicit call, visible failure, re-runnable by command.
- **`page_count` is free** — the PDF is already being parsed for `text_content`, and the reader
  needs it for page controls without re-parsing on every open.
- **Upload path** is a callable producing `chapters/<book_slug>/<order_index>-<uuid>.pdf`. Without
  the UUID, re-uploading a corrected chapter either overwrites silently or gets a mangled suffix,
  and readers with the file cached keep seeing the old one.

> **Deploy checklist — the storage bucket must be private.** `django-storages` can serve files
> publicly, and many tutorials configure exactly that. If it happens here, every PDF gets a
> permanent public URL and the temporal-security mandate, the grant tokens, the 7-day expiry, and
> the whole proxy design are bypassed **at the infrastructure layer while the application code
> still looks correct**. Nothing generates URLs — the API only ever streams bytes.

### `Order`
`user` (FK) · `book` (FK) · `pace` · `created_at`. `unique_together (user, book)`.

- **Stripe fields dropped.** V1's `stripe_session_id` was unique *and required*, which makes a
  concierge-created order impossible to save. `amount_cents` goes with it. Payments add both when
  payments land, by which time their real shape is known (payment intent, refund state, idempotency
  key). The committed seam is `onboarding.create_reader(...)`, not speculative columns.
  **Follow V1?** ☐ yes ☑ no
- **`unique_together (user, book)`** makes `access.can_read` a simple existence check and stops an
  admin double-creating an order and silently doubling a reader's grants.
- **Name kept** — an entitlement today, a purchase record again once payments return. Renaming
  twice is worse than one slightly-early name.
- **`created_at` is the cadence anchor**: chapter N unlocks at `created_at + (N-1) × delay`.

### Pace — neutral keys, poetic labels
```
DB:        "slow" | "medium" | "fast"      ← stable, never migrated for a rename
labels.ts: Largo · Andante · Allegro       ← display only
```
- **Delays live in config** (`content/`, env-overridable for the demo), never in a table and never
  hardcoded in `cadence.py`. A table would let someone change reading-tempo semantics by editing a
  row; a constant means the demo cannot run fast without a code change.
- **Why not V1's `crawl`/`steady`/`soar`:** "Crawl" frames the slowest tier as deficient and "Soar"
  makes the fastest sound aspirational — ranking speed as superior on a product whose pitch is that
  depth beats velocity. Musical tempo is the only metaphor that *is* the mechanism (a rate over
  time) and carries no ranking. Pair each with its literal cadence in the UI — "Largo — a chapter
  each week."
  **Follow V1?** ☐ yes ☑ no

---

## D21 — `TemporalGrant`, `MessageLog`, `ChatUsage`, `PasswordResetToken`

**Locked** 2026-08-09

### `TemporalGrant`
`user` (FK, required) · `chapter` (FK) · `token` (unique) · `expires_at` (`created_at + 7d`) ·
`unlock_at` (nullable, **always null for now** — the cadence seam) · `opened_at` (nullable) ·
`created_at`. Index on `(user, chapter)`.

- **`(user, chapter)` is deliberately NOT unique.** Re-issue (D9, and the Home send button) mints a
  **new row with a new token**; `mint_or_reuse` selects the newest unexpired one.
  *If it were unique*, re-issue would extend `expires_at` in place and **the old token would stay
  valid** — silently reviving access for anyone holding a forwarded expired link, and undoing the
  entire point of 7-day expiry for exactly the case it was designed for. A few extra rows per
  reader per chapter is nothing by comparison. **This looks obviously wrong and is deliberate.**
- **`opened_at` records the FIRST open**, not the last. It is an engagement signal and what the
  deferred unread-reminder keys off. Last-open would be analytics, which we are not collecting.
- **Token default must be a module-level wrapper:**
  ```python
  def generate_token():
      return shortuuid.uuid()
  ```
  V1 lost an entire ticket here — `shortuuid.uuid` is a *bound method* on a module singleton, so
  using it directly as a field default broke every insert at runtime and then sent Django's
  autodetector into an infinite migration loop. The wrapper gives the migration a stable import
  path.

### `MessageLog`
`user` (FK) · `template_key` · `grant` (FK, **nullable**) · `to_phone` · `status`
(`pending`/`sent`/`failed`) · `attempts` · `provider_message_id` (nullable) · `error` (nullable) ·
`created_at` · `sent_at`.

- **`grant` is nullable and is a grant, not a chapter.** Two of the four templates have no chapter
  — password reset is an account message. `grant` also identifies *which token was sent*, so a
  report of a dead link leads straight to the exact grant; chapter is derivable from it.
- **`to_phone` is a snapshot.** A reader changes their number and every historical row would
  otherwise claim messages went somewhere they didn't. Logs record what happened, not what is
  currently true.
- **Never store the rendered body.** It contains a live token — a credential — and duplicating it
  gives two places to leak from instead of one. `template_key` + `grant` reproduces it exactly.
- **Write `pending` before the attempt, update in place.** With no queue (D17), a crash mid-send
  leaves evidence rather than nothing.
- **`sent` means Twilio accepted it, not that it arrived.** True delivery needs Twilio status
  webhooks, which are not scoped. Do not over-trust this field later.

### `ChatUsage`
`grant` (FK) · `date` · `message_count` · `input_tokens` · `output_tokens`.
`unique_together (grant, date)`.

- **Keyed by grant, not user**, because `/api/chat` is token-authenticated (D7) and the caller may
  have no session. The grant carries a user FK for rolling up later.
- **The global ceiling needs no second table** — sum today's rows. Both limits read from env so
  they can be tightened without a deploy.

### `PasswordResetToken`
`user` (FK) · `token` (unique, same wrapper) · `expires_at` (**~1 hour**) · `used_at` (nullable) ·
`created_at`.

- **Single use.** `used_at` is set when the password actually changes. Reset links sit in WhatsApp
  history forever, so a reusable one is a permanent account key.
- **Requesting a new reset invalidates outstanding ones** — otherwise three requests leave three
  live keys.
- **Rate limit: one request per user per 15 minutes.** Without it, "send me a reset link" is a
  button that spams someone's WhatsApp.
