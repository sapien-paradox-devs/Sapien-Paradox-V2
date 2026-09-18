# Infrastructure

D5 · D6 · D16 · D17 · D20

---

## D5 — Deploy-first, with real external dependencies from Phase 0

**Locked** 2026-08-08

Real managed Postgres, real object storage, real credentials — provisioned and deployed before
there is much to deploy. Deployment is not a separate project at the end.

**Consequences:** DB read from `DATABASE_URL` (`dj-database-url`) at first commit · files through
Django's storage backend (`django-storages`), backend chosen by env · every integration reads env
and has a console/no-op fallback, so a fresh clone runs with zero credentials.

**Rejected:** local-first with the host deferred (my original recommendation; overruled). The
overrule was correct — retrofitting object storage after content exists means a data migration.

**Lead-time item — Twilio WhatsApp is the long pole.** The sandbox works instantly but every
recipient must text a join code first. Production sending needs a WhatsApp Business Sender: Meta
Business account, business verification, and approved templates before you may message a user who
has not messaged you first. Days-to-weeks of waiting. **Start first.** Anthropic is an instant
key; Stripe test mode is instant.

---

## D6 — Split origin under one parent domain

**Locked** 2026-08-08

`app.<domain>` (static SPA) + `api.<domain>` (Django), session cookie scoped to `.<domain>`.

**Why:** unrelated domains (`…vercel.app` → `…onrender.com`) make the session cookie a
third-party cookie needing `SameSite=None; Secure` — which Safari ITP and most blockers drop, so
login silently fails on some devices. V1 never hit this because both sides ran on `localhost`.

**Also:** WhatsApp links carrying a real domain matter for a product selling restraint and craft.

**Rejected:** single-origin, Django serving the SPA (simpler and genuinely defensible, but couples
deploys) · split hosts on vendor domains (the third-party-cookie problem above).

**Phase 0 tasks this creates:** register the domain · DNS for both subdomains · CORS allowlist,
`CSRF_TRUSTED_ORIGINS`, and `SESSION_COOKIE_DOMAIN` configured from env.

**Repo topology:** a single monorepo, decided alongside this. A vertical slice is one PR spanning
both apps; V1 split repos by lane, so every feature was split in half with manual cross-repo merge
ordering (T011 → T011a + T011b), and `plans/` lived in no repo at all. The one real cost is that
GitHub grants access per repo, so there is no per-directory access control.

---

## D16 — Five external systems. No email provider.

**Locked** 2026-08-09

| System | Owns | If it's down |
|---|---|---|
| Postgres (managed) | all application data | app is down |
| Object storage (R2/S3) | PDF files | reading fails; rest works |
| Twilio | WhatsApp delivery, expired-link recovery, **password reset** | no new links; existing ones keep working |
| Anthropic | the companion | chat unavailable; reading unaffected |
| Stripe | payments — later (D10) | — |

**No email provider anywhere.** WhatsApp is the only outbound channel. Password reset sends a link
over WhatsApp: every reader has a verified phone (D19 makes it unique), the delivery service
already exists, and it needs one more Meta template — **a fourth, submitted in the same Phase −1
batch** while the waiting is free.

**Rejected — a transactional email provider** (Postmark/Resend/SES): adds a vendor, credentials, a
sender domain with SPF/DKIM, and its own template, to duplicate a channel we already have. Its one
real advantage is independence from Twilio.

**Rejected — no self-serve reset at all:** honest at ten readers, embarrassing at a hundred. Used
as the interim until templates clear.

**Accepted consequence:** Twilio becomes the only self-serve way back into an account. If Meta
rejects the templates or suspends the sender, recovery is an admin doing it by hand.

**Error tracking (Sentry) deferred.** Unlike storage and DB config, it is trivially retrofittable
— ten lines and a DSN. **Revisit before the first person who isn't the owner uses the app**, since
it only captures errors occurring after installation and cannot backfill. The argument for it:
server logs cannot see browser failures at all, and this product's riskiest surface is the reader's
device — canvas memory limits on phones, WhatsApp's in-app WebView, Safari dropping the
cross-subdomain cookie. V1 hit exactly this class of bug (`bb89041`, "correct worker URL and canvas
height CSS") and Django would have logged clean 200s throughout.

---

## D17 — No job queue. Bounded retry inside the request.

**Locked** 2026-08-09

WhatsApp sends are synchronous and best-effort; a Twilio failure never breaks the transaction.

**Retry only transient failures** — network error/timeout, HTTP 429, HTTP 5xx. **Never retry 4xx**
(invalid number, unapproved template, recipient opted out): permanent, so retrying is pure delay.
**3 attempts, backoff 0.5s → 1.5s**, worst case ~2s added. Every attempt is recorded in
`MessageLog` with attempt count, final status, and last error, so permanent failures are visible in
admin and re-sendable by hand.

**Known caveat:** if Twilio delivered but the response timed out, a retry sends a duplicate. Twilio
does not dedupe. A duplicate chapter link is harmless; a lost one is not.

**Rejected — a queue now** (Celery/RQ/django-q): means Redis (a sixth external system), a second
process to deploy and monitor, and a class of "the worker is wedged" debugging — before there is a
single reader.

**Cadence later** is a management command on the host's cron. Because every send already goes
through `whatsapp.send_chapter(grant)` (D12), making it async later changes one function's body,
not its callers.

---

## D23 — Platform: modular monolith, two infrastructure vendors

**Locked** 2026-08-09
**Governing constraint: a very low-cost business run by one developer.** Cost and *attention* are
the scarce resources. Every choice below is made against that, not against scale.

### Architecture: a modular monolith

One Django app with strict internal layering, one SPA. **Not services.** At eight tables and one
product, service boundaries buy isolation nobody needs and cost network hops and deployment
complexity. The seams (`access.can_read`, `onboarding.create_reader`, `whatsapp.send_chapter`)
provide the modularity; a process boundary would only add operational overhead.

### Backend framework: Django + Django Ninja — confirmed, not inherited

Re-examined explicitly rather than carried over from V1. Four things this design leans on:

1. **Django admin — the decisive one.** D10 makes concierge onboarding the *entire* way readers
   come into existence. Admin gives a working CRUD surface over eight tables, with search,
   filters, and custom actions, for near-zero lines. In FastAPI or Node that is weeks of work on a
   screen that is not the product.
2. **Auth** — sessions, password hashing, the permission system `is_staff` uses (D19).
3. **Migrations** — eight tables that grow with payments and cadence.
4. **Management commands** — `seed_dev`, `send_chapter`, and cadence later (D17 puts it on the
   host's cron as a management command). First-class in Django, ad-hoc scripts elsewhere.

**Rejected:** FastAPI (would assemble five libraries by hand — admin, auth, SQLAlchemy, Alembic,
commands) · Node/NestJS (same, and AdminJS is weaker) · Next.js full-stack (no admin equivalent;
PDF streaming through API routes is unpleasant) · Supabase/BaaS (the access model is *custom* —
grant tokens, expiry, proxied bytes — so it would live in RLS policies and Edge Functions,
fighting the platform).

**The one real argument against — a single language across the stack** — is weak here: the
frontend is a Vite SPA, so a Node backend would share no components, only types, and D20 already
solves type-sharing for the things that matter.

**Note:** the always-on-process requirement comes from **proxied PDF streaming**, not from Django.
Any framework would need it. Django is not constraining the platform; the access model is.

### Vendors — six total, two actively managed

| Vendor | Does | Cost |
|---|---|---|
| **Cloudflare** | registrar · DNS · Pages (SPA) · R2 (PDFs) | free / at-cost |
| **Render** | Django web service · **managed** Postgres | **~$5–7/mo** |
| GitHub | source, CI | free |
| Twilio | WhatsApp (D16) | per message |
| Anthropic | the companion (D13) | per token |
| *payment provider* | later — **open** | % per transaction |

Cloudflare is the consolidation: DNS is needed regardless, so R2, Pages, and the registrar cost
**nothing in vendor count**. Render's *managed* Postgres removes backups, patching, and a
`pg_dump` cron nobody would check.

**Rejected — a single VPS** (Hetzner, ~€4/mo, genuinely one vendor, and a real persistent disk
would even remove the need for object storage): you become the sysadmin — OS patching, TLS
renewal, Postgres backups, noticing when the disk fills at 2am. Saves ~$4/month and acquires an
ops job. Wrong trade when attention is the scarce resource.

**Rejected — Vercel:** replaces nothing. The SPA goes on Cloudflare Pages, already paid for by the
DNS we need. Adding it means a third dashboard for a job Cloudflare does.

**Rejected — a Render disk instead of R2:** welds files to one instance, makes backups our problem
again, and requires sizing a disk. R2 is free at this volume inside a vendor we already have.

### The one place to spend money

**Never use a backend tier that sleeps.** Free tiers spin down and cold-start in roughly a minute;
the same applies to Postgres tiers that pause when idle.

This is a **product** decision, not a cost one. The core moment is *tap a WhatsApp link → the
chapter opens.* A reader staring at a blank screen for 50 seconds has had the product fail and
will never know why. Everything else in the stack can be free. This cannot.

### Storage: R2, private bucket, proxied and chunked

Egress is charged on **every read**, not once per upload, because D19 proxies the bytes. At current
scale that is under a dollar either way — so R2 wins on other grounds: S3-compatible (identical
`django-storages` code), egress removed as a permanent future concern, and one fewer vendor.

**Proxying is retained over short-lived signed URLs.** A signed URL would be faster and nearly free
on server bandwidth, but it exposes a storage URL — which the temporal-security mandate forbids —
and once issued it works for its full lifetime regardless of what happens to the grant. Proxying
keeps grant state authoritative on every request and makes revocation instant.

**Implementation:** `StreamingHttpResponse` in chunks. Reading a 10 MB PDF fully into memory per
concurrent reader is how a small instance falls over.

### Three cost traps in this design

1. **WhatsApp is not free.** Meta charges per conversation window, business-initiated costing more.
   Email would have been near-free at this volume — a real cost of D16 that was not weighed at the
   time. WhatsApp is retained for the product reason (self-authenticating links, in-app browser, no
   cookie), but it is an argument against adding chatty features like reminders too eagerly.
2. **The companion re-sends the whole chapter on every message.** D13 puts the full text in the
   system prompt; a 20-page chapter is roughly 10k input tokens, so a 20-message conversation is
   ~200k input tokens. **Use prompt caching** — a large constant prefix with a small varying suffix
   is the textbook case. No design change, substantial saving.
3. **Proxied PDFs consume the instance's bandwidth.** R2's free egress covers the storage side; the
   server side is ours. Another reason not to run the smallest possible tier.

---

## D22 — Logging: stdout only, and never log a token

**Locked** 2026-08-09

**"Logs" here is three separate needs, and two are already solved as database tables:**

| Need | Where |
|---|---|
| Why did this reader's message fail? | `MessageLog` (D21) |
| What did the companion cost, and for whom? | `ChatUsage` (D21) |
| Why did the server 500? | application logs → stdout ← *this decision* |

**Django logs structured JSON to stdout; the host viewer captures it. No log vendor.** JSON costs
nothing now and makes shipping to a service later a config change rather than a reformatting
exercise.

Accepted limits: short retention (~a week on lower tiers), weak search, lost across enough
redeploys. Tolerable because the two product-critical logs are durable tables, and while the owner
is the only user, "go look at the host dashboard" is a complete strategy.

**Revisit together with Sentry**, at the same trigger — before the first person who isn't the owner
uses the app. Sentry ingests logs as well as errors, so that is **one vendor, not two**; log
services are not to be evaluated separately.

### Hard rule — never log a token

**Never log a grant token, a reset token, or a full `/r/:token` URL. Log the grant's `id`.**

D21 forbids storing the rendered message body in `MessageLog` precisely because it contains a live
token — a credential. Logging the same URL would undo that decision entirely, and **logs are less
protected than the database**: visible in a host dashboard, shipped to third parties, readable by
anyone with deploy access.

Same applies to passwords (Django handles this) and to phone numbers inside message payloads.

---

## D20 — Shared constants in one file, read by both sides

**Locked** 2026-08-09

```
shared/constants.json      ← the single source of truth
```

Python reads it with `json.load`. TypeScript imports it, wrapped in a thin `.ts` re-export using
`as const` so literal union types survive instead of widening to `string`. No codegen, no build
step. **Only the monorepo makes this possible** — two repos would need a published package.

**Inclusion rule: share it only if a mismatch between the two sides is a bug.**

| In | Why |
|---|---|
| Pace keys (`slow`/`medium`/`fast`) | backend stores, frontend renders |
| Route patterns (`/r/:token`, `/login`, `/read/:chapterId`) | **backend builds WhatsApp links, frontend routes them** — drift means every link in every message 404s |

| Out | Why |
|---|---|
| Display names (Largo/Andante/Allegro) | `labels.ts` only; backend renders no text |
| Pace delays | backend only, env-overridable for the demo |
| Caps and rate limits | enforced backend-side; frontend learns state from the API response |

**Rejected:** codegen from YAML (adds a build step and a "did you regenerate?" failure mode) ·
serving constants from an API endpoint (network round-trip for static data, still untyped) ·
duplicating with a matching test (the fallback if a host isolates the subdirectory).

**Phase 0 verification:** both apps deploy from subdirectories, so `../../shared/` must exist in
each build context. Most hosts clone the whole repo and build from the subdirectory, but not all —
confirm on the real hosts while there is nothing to lose.

---

## D34 — Vercel hosts the SPA, not Cloudflare Pages

**Locked** 2026-08-30
**Amends D23**, which rejected Vercel by name. That rejection stands as written and is not deleted;
this decision overrides its conclusion, not its reasoning.

### What changed

The SPA deploys to **Vercel**. Cloudflare keeps the registrar, DNS, and R2.

### Why D23 rejected it, and what that costs us

D23's argument was **vendor count, not capability**: "replaces nothing… a third dashboard for a job
Cloudflare does." That argument is still correct. We are accepting a fourth actively-managed vendor
for a job an existing vendor could do.

This is an owner's preference, taken knowingly. Nothing technical forced it.

### What it does *not* cost us — correcting an error made while deciding

**D6 is not violated.** D6 requires `app.` and `api.` to be siblings under one parent *domain*; it
says nothing about vendors. Vercel serves custom domains, so `app.<domain>` → Vercel and
`api.<domain>` → Render satisfies D6 exactly as Pages would have.

The third-party-cookie failure applies only while the SPA is on `*.vercel.app` and the API on
`*.onrender.com` — a temporary state identical to the one `pages.dev` would have produced, and
resolved by the same action: point the real domain at both.

### What this actually requires

| Concern | Handling |
|---|---|
| Monorepo | Root Directory `apps/web`; **"Include files outside the Root Directory" must be ON**, or `@shared → ../../shared` fails to resolve and the build breaks (D20) |
| Deep links | SPA routes (`/r/:token`, `/read/:chapterId`) 404 without a catch-all rewrite to `index.html`. `apps/web/vercel.json` carries it |
| Build isolation | Vercel builds `apps/web` on every push by default, including API-only commits. Ignored-build step scopes it, mirroring the path filters CI already uses |

### Revisit if

Vercel's free tier stops covering a static SPA, or the fourth dashboard proves to be the attention
cost D23 predicted. Moving back to Pages is a re-point of one DNS record and a build-settings
change — the SPA has no Vercel-specific code, and `vercel.json` is the only artefact to delete.

---

## D35 — Phase 0 deploys on free tiers, which suspends D23's no-sleep rule

**Locked** 2026-08-30
**Temporarily suspends** the "never use a tier that sleeps" clause of D23. **This is time-boxed and
must be reversed before the first WhatsApp link is sent to anyone.**

### The decision

Render's free web service and free Postgres, for Phase 0 only. Cost: $0.

### What D23 said, and why suspending it is safe *right now*

D23's rule is a **product** decision: *tap a WhatsApp link → the chapter opens*, and a 50-second
cold start means the product has failed silently. That reasoning is untouched and still correct.

It does not bite yet because **there is no reader and no WhatsApp link.** Phase 0 deploys a health
endpoint and an empty SPA. Nobody taps anything. The rule protects an experience that does not
exist for another four phases.

### What we accept in exchange

| Free-tier limit | Consequence here |
|---|---|
| Web service spins down after 15 min idle, ~1 min cold start | **The D23 violation.** Tolerable only while no reader exists |
| `preDeployCommand` is **paid-only** | Migrations move into `startCommand` (`migrate && gunicorn`). Re-runs on every restart; safe because migrations are idempotent and free tier is a single instance |
| Postgres **expires 30 days after creation**, 14-day grace, then deleted | **Hard deadline. Created 2026-09-18 → expires ~2026-10-18.** No backups on this tier, so upgrade before then or lose the data |
| Postgres 1 GB, one free instance per workspace, no backups | Irrelevant at Phase 0 volume |
| Ephemeral filesystem | Harmless — PDFs live in R2 (D19) and static files are rebuilt each deploy |

### Amended 2026-09-18 — the premise weakened before the deploy happened

This decision was written when nothing was built. By the time the deploy actually ran, the seams,
WhatsApp delivery, the message templates and the reading chamber were all written, and real
messages had been sent to a real handset from the prototype bench. **Re-confirmed as free anyway**,
because `main` still carries only the machine framework and the tables: the deployed surface is a
health endpoint and an empty SPA, so nothing a reader touches can cold-start. The reversal
condition below is now the operative part of this decision, not a footnote.

### The reversal condition — not optional

Upgrade **both** the web service and Postgres to paid plans when *either* comes first:

1. **Before the first WhatsApp link goes to a real reader** (D23's actual trigger), or
2. **Before ~2026-10-18**, or the database is deleted after its grace period.

### Rejected

**Paid from day one** (~$5–7/mo, what `render.yaml` originally specified): correct on the merits and
avoids both the migration and the deadline. Overridden by the owner for a Phase 0 with no readers.

**Free web service, paid Postgres:** removes the deletion deadline but keeps the sleep, which is the
clause that actually matters. Pays money to fix the wrong half.
