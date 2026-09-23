# API and access

D7 · D11 · D12

---

## D7 — Auth surface map

**Locked** 2026-08-08

| Surface | Auth |
|---|---|
| `/login`, `POST /api/auth/login` | public |
| `/`, `GET /api/home` | session |
| `/read/:chapterId` | session — mints-or-reuses a grant, then redirects (D11) |
| `/r/:token`, `GET /api/grants/:token` | **token only** |
| PDF bytes | **token only** |
| `POST /api/chat` | **token only** |
| `POST /api/chapters/:id/send` | session |

**Two Ninja auth classes**, mirroring the two dimensions: `SessionAuth` and `GrantAuth` (resolves
the token from the path, checks expiry). Each endpoint declares exactly one. No endpoint accepts
both.

### The consequence we accepted

`/api/chat` is **unauthenticated *and* spends money per call.** Grant links travel over WhatsApp,
get forwarded, and persist in chat history. It is the only endpoint with an uncapped per-request
cost.

**Therefore, built in Phase 5 rather than bolted on:** per-grant daily message cap, a global daily
ceiling as a kill switch, a max input length, and per-grant logging (`ChatUsage`, D21) so spend is
attributable.

**Rejected — requiring a session for chat:** it would delete the feature on phones, which is
exactly where it is most useful, and undercut the reason tokens exist at all.

---

## D11 — Home links are session-gated and mint on demand

**Locked** 2026-08-08

Chapters on Home link to `/read/:chapterId`, which requires the session, finds a live grant or
mints a fresh one, then redirects to `/r/:token`.

**Why:** with 7-day expiry (D8), returning stored tokens would make Home a list of mostly-dead
links — absurd for the one surface that must always work. Resolving at click time makes Home
**structurally incapable** of showing a broken link, and keeps chapter tokens out of the
`GET /api/home` payload entirely.

**Rejected:** returning tokens in the Home payload and refreshing expired ones server-side — mints
grants for chapters never clicked, and puts a pile of live tokens in one response.

**Display:** number, title, and a quiet read/unread mark from `opened_at`. Flat for one book,
grouped for several. No progress bars, percentages, or badges — they fight the product's restraint.

> **Superseded in part by D70** (2026-09-23): reading progress is now shown, quietly — a ring per
> chapter and a total per book. Badges and rewards remain out.

**Account block at top:** name, email, phone, book, logout.

### Send a chapter to my WhatsApp

Every unlocked chapter carries a second action beside opening it.

```
POST /api/chapters/{chapter_id}/send          auth: session
  → access.can_read(user, chapter)            must own it
  → grants.mint_or_reuse(user, chapter)       live grant, or a fresh one
  → whatsapp.send_chapter(grant)              the same seam everything else uses
  → 202 + the MessageLog id
```

**Rate limit: one send per chapter per hour, per reader** — same shape as D9's re-issue limit.
Without it a bored reader burns Twilio credits with a button.

This is the D12 seam paying for itself: no new delivery path, no new template, one endpoint. It
also makes WhatsApp a **library** channel rather than only a delivery one — "push this to my phone
so I can read it on the train" — coherent with 7-day expiry, since re-sending is how an old chapter
is revived.

---

## D12 — Message templates in their own config file

**Locked** 2026-08-08 · extended 2026-08-09 (fourth template)

Mirrors the `labels.ts` mandate: copy is editable without touching send logic. Each entry carries
its internal key, the Meta/Twilio template identifier, its variable order, and a plain-text
rendering used by console dev mode.

**Why this is urgent, not cosmetic:** WhatsApp forbids free-form business-initiated messages
outside a 24-hour window. Every template must be **pre-approved by Meta** — fixed wording, numbered
variables, days of review, resubmission on rejection. **Message copy is a Phase 0 deliverable, not
a Phase 4 one.**

**Submit all four together**, including the cadence-era reminder — an approved unused template
costs nothing and keeps cadence off Meta's critical path later:

1. Chapter delivery
2. Fresh link (D9 re-issue)
3. Unread reminder (cadence-era, submitted early)
4. **Password reset** (D16 — added once we decided against an email provider)

**Triggers, all through one `whatsapp.send_chapter(grant)`:**

| Trigger | Sends |
|---|---|
| `onboarding.create_reader(...)` | chapter 1, automatically |
| Django admin action | that chapter, to that reader |
| `manage.py send_chapter --email --chapter` | same, from the CLI |
| Sanctuary re-issue (D9) | a re-minted grant, rate-limited |
| Home "send to my WhatsApp" (D11) | a minted-or-reused grant, rate-limited |

Cadence later adds another and reuses the same service.

**Dev fallback:** with no Twilio credentials the service prints to console. Local work and CI never
touch the network or spend money.

**Open — this gates everything:** the template copy itself. Deferred until the overall picture is
clear; it **blocks Meta submission → the Phase 4 demo.** Close it early.
