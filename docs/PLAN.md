# PLAN — the development tree

> **What this is.** One tree, from the root of the product down to issue-sized leaves, in two
> halves: **what we build** (§2) and **how the code is arranged while we build it** (§3).
>
> **What this is not.** Not a decision record — proposals here become `decisions/NN-*.md` before
> any of them is built. Not a status file — `STATUS.md` tracks state; this tracks shape.
>
> **Last updated:** 2026-09-23

---

## Resume here

For a session picking this up cold.

| | |
|---|---|
| **Done** | Repo survey (both apps, every file) · web research (§4) · the feature tree (§2) · the restructuring diagnosis and target (§3) · the self-review (§5) |
| **Next** | Open the issues in §6 · write D49–D52 · land R0–R1 · Surface track: #117 on real phones, then #118 → #119 → #120 (§2.9) |
| **Not started** | Any code. Nothing in this document has been implemented. |

---

## 1. Where we actually are

`STATUS.md` was last true on 2026-08-30, at PR #14 and "the machine layer is built and unmerged."
It is now three weeks and ninety-five PRs stale. The ground truth, read from the tree on
2026-09-23:

| | Built | Evidence |
|---|---|---|
| Models | 8 tables, admin, migrations | `core/models.py` (438 lines) |
| Services | 8 modules — the three seams plus grants, companion, extraction, payments, phone | `core/services/` |
| API | 8 routers, ~15 endpoints | `core/api/` |
| Machines | framework + 4 machines | `core/machines/` |
| Frontend | root machine + 7 pages + 8 components, 5-file split throughout | `apps/web/src/` |
| Tests | **246** backend, **87** frontend | `manage.py test core`, `npm test` |
| Deploy | Render + Vercel live, R2 proven, Razorpay test payment proven | D34, D35 |

**Phases 0–5 of `DESIGN.md`'s roadmap are substantially built.** The roadmap table in `DESIGN.md`
and the phase checklist in `STATUS.md` both describe a project that no longer exists.

Three things are true at once, and holding all three is the whole point of this document:

1. **The product is nearly feature-complete for its first slice** — a reader can be bought into
   existence, log in, see their chapters, read one, talk to the companion, and recover a dead link.
2. **Its headline feature does not exist.** Cadence — "chapters unlock on a schedule" — is the
   first sentence of `DESIGN.md` and is not implemented anywhere. `unlock_at` is written in
   `models.py`, read by one guard, and set by nothing.
3. **The structure has drifted from its own decisions.** D36 declares machines the orchestration
   layer. Three of the four machines have no production caller.

---

## 2. Tree one — the product

Read it as: **root → capability → sub-feature → leaf.** A leaf is issue-sized: one branch, one PR.

Status marks: **✅** built and demoed · **◐** partly built · **○** not started · **⚠** built and wrong.

### 2.0 The root

> **A reader buys a book. Its chapters unlock on a schedule. Each arrives by WhatsApp as a
> self-authenticating link. They read it in a token-gated chamber and discuss it with a companion.**

Every capability below is one clause of that sentence. If a proposed feature is not a clause of it,
it is not in this tree — that is the test.

```
THE PROMISE
├── 1  ACQUISITION      ── "a reader buys a book"
├── 2  IDENTITY         ── "a reader"
├── 3  CADENCE          ── "chapters unlock on a schedule"
├── 4  DELIVERY         ── "arrives by WhatsApp"
├── 5  READING          ── "a token-gated chamber"
├── 6  COMPANIONSHIP    ── "discuss it with a companion"
└── 7  STEWARDSHIP      ── (not in the sentence: how the owner runs it)
```

Seven capabilities, five external systems, eight tables. **The seven map onto the backend domains
proposed in §3.4** — that is deliberate, and it is what makes the two trees one tree.

---

### 2.1 ACQUISITION — how a reader comes to own a book

```
1 ACQUISITION
├── 1.1 Catalogue
│   ├── 1.1.1 GET /api/books, published only                          ✅
│   ├── 1.1.2 Landing page that sells one book                        ✅
│   ├── 1.1.3 Book detail — sample chapter, table of contents         ○
│   └── 1.1.4 More than one book on sale at once                      ◐  works; never exercised
├── 1.2 Checkout
│   ├── 1.2.1 Razorpay payment link, hosted page                      ✅
│   ├── 1.2.2 Pace chosen at purchase (slow/medium/fast)              ✅  inert until 3
│   ├── 1.2.3 Price shown in minor units, one currency                ✅
│   ├── 1.2.4 Live keys — KYC                                         ○  Track A, weeks
│   └── 1.2.5 International cards / currency                          ○  deferred, not decided
├── 1.3 Fulfilment
│   ├── 1.3.1 Webhook leg, signature-verified                         ✅
│   ├── 1.3.2 Redirect leg (D48)                                      ✅
│   ├── 1.3.3 Idempotency on payment_reference + identity fallback    ✅
│   ├── 1.3.4 Welcome page while fulfilment settles                   ✅
│   └── 1.3.5 Refund → revoke entitlement                             ○  can_read has no path
└── 1.4 Entitlement
    ├── 1.4.1 Order row, unique per (user, book)                      ✅
    ├── 1.4.2 access.can_read is the only check                       ✅
    ├── 1.4.3 Subscriptions — a second path to "yes"                  ○  seam ready (D25)
    └── 1.4.4 Gifting                                                 ○  out of scope, recorded
```

**The gap that matters:** 1.3.5. Money can come in and cannot go back out. `can_read` asks about
`Order` existence, and a refund has nowhere to write. One nullable `revoked_at` and one clause.

---

### 2.2 IDENTITY — how a reader proves who they are

```
2 IDENTITY
├── 2.1 Birth
│   ├── 2.1.1 onboarding.create_reader — the only way (D26)           ✅
│   ├── 2.1.2 Four identity cases as four guarded rows                ◐  machine written, unwired
│   ├── 2.1.3 Identity conflict refused loudly, not guessed           ✅
│   └── 2.1.4 ONBOARDING_ALLOW_PHONE_REUSE                            ⚠  REVERT BEFORE LAUNCH
├── 2.2 Credentials
│   ├── 2.2.1 Set-a-password page, token-authenticated                ✅
│   ├── 2.2.2 Login / logout / me                                     ✅
│   └── 2.2.3 Password rules, strength, breach check                  ○  Level 3, deferred
├── 2.3 Recovery
│   ├── 2.3.1 Reset request over WhatsApp (D16)                       ✅
│   ├── 2.3.2 Single-use token (D21)                                  ✅
│   └── 2.3.3 Cooldown counted from rows (D31)                        ✅
├── 2.4 Session
│   ├── 2.4.1 Cookie scoped to the parent domain (D6)                 ✅
│   ├── 2.4.2 SameSite env-driven, None in production                 ✅
│   ├── 2.4.3 Rehydrate from GET /api/auth/me on boot                 ✅
│   └── 2.4.4 **Verified on Safari**                                  ○  DESIGN.md calls this the
│                                                                        most likely quiet failure
└── 2.5 The account itself
    ├── 2.5.1 Change phone number                                     ○  and it is the login key
    ├── 2.5.2 Change email                                            ○
    └── 2.5.3 Delete my account                                       ○
```

**Two gaps that bite on the first real reader:** 2.1.4 is a live security hole behind a flag, and
2.5.1 does not exist — a reader who changes their number is unreachable forever, because the phone
is both the delivery address and half the identity.

---

### 2.3 CADENCE — how a chapter becomes available

**The whole of this capability is unbuilt.** It is the product's first sentence.

```
3 CADENCE
├── 3.1 The schedule
│   ├── 3.1.1 pace → interval, from shared/constants.json             ✅  keys exist
│   ├── 3.1.2 unlock_at = Order.created_at + (N-1) × interval         ○  nothing computes it
│   ├── 3.1.3 Computed at order time, for every chapter, once         ○  ← design choice, §3.7
│   └── 3.1.4 Chapter 1 unlocks immediately                           ✅  by accident: null = live
├── 3.2 The tick
│   ├── 3.2.1 manage.py cadence_tick — find due, send UNLOCK (D39)    ○
│   ├── 3.2.2 Host cron, no queue, no broker (D17)                    ○
│   ├── 3.2.3 Idempotent: a double tick delivers once                 ○
│   └── 3.2.4 Catch-up after an outage is free, by construction       ○
├── 3.3 The unlock
│   ├── 3.3.1 UNLOCK row on the reading machine                       ◐  written, unreachable
│   ├── 3.3.2 Delivery success guards the transition (D40)            ◐  written, unreachable
│   └── 3.3.3 A failed send retries on the next tick, not now         ◐
├── 3.4 Reader control
│   ├── 3.4.1 Change pace mid-book                                    ○  recompute future only
│   ├── 3.4.2 Pause and resume                                        ○  holidays are real
│   └── 3.4.3 "Send me the next one now"                              ○  breaks the premise?
└── 3.5 The end
    ├── 3.5.1 Last chapter delivered — what is said                   ○
    └── 3.5.2 What Home shows a finished reader                       ○
```

**Everything above the line in 3.3 is already written and tested against fakes.** Cadence is not a
large build. It is ~1 command, ~1 service function, and the wiring the machine layer was designed
for. It is the single highest-value item in this document.

---

### 2.4 DELIVERY — how a chapter reaches a reader

```
4 DELIVERY
├── 4.1 The channel
│   ├── 4.1.1 Twilio backend                                          ✅  sandbox proven
│   ├── 4.1.2 Console backend, no credentials (D5)                    ✅
│   ├── 4.1.3 WABA sender + business verification                     ○  Track A, weeks
│   └── 4.1.4 Four approved templates                                 ○  Track A, blocks demo
├── 4.2 The triggers (D12, D27)
│   ├── 4.2.1 Chapter delivery                                        ✅
│   ├── 4.2.2 Fresh link (sanctuary)                                  ✅
│   ├── 4.2.3 Password reset                                          ✅
│   ├── 4.2.4 Unread reminder ~24h after unlock                       ○  template in batch 1
│   └── 4.2.5 Send-to-my-WhatsApp from Home                           ✅
├── 4.3 The ledger
│   ├── 4.3.1 MessageLog on every send                                ✅
│   ├── 4.3.2 pending → sent | failed as a machine                    ◐  written, unwired
│   └── 4.3.3 Never log a token (D22)                                 ✅
├── 4.4 Failure
│   ├── 4.4.1 Bounded in-request retry (D17)                          ✅
│   ├── 4.4.2 Delivery returns, never raises (D27)                    ✅
│   ├── 4.4.3 Permanent vs transient split                            ✅
│   └── 4.4.4 Admin resend action + manage.py send_chapter            ✅
└── 4.5 Respect
    ├── 4.5.1 Opt out of reminders                                    ○
    ├── 4.5.2 Quiet hours — no 3am chapter                            ○  cadence makes this real
    └── 4.5.3 Meta's ~2 marketing templates/user/day ceiling          ○  see §4.3
```

---

### 2.5 READING — the chamber

```
5 READING
├── 5.1 Access
│   ├── 5.1.1 grants.validate — is the token live                     ✅
│   ├── 5.1.2 mint_or_reuse, idempotent GET (D32)                     ✅
│   ├── 5.1.3 7-day expiry, derived not stored (D8)                   ✅
│   └── 5.1.4 Token alone authenticates; ownership re-checked         ✅
├── 5.2 The chamber
│   ├── 5.2.1 Proxied PDF bytes, chunked (D29)                        ✅
│   ├── 5.2.2 PdfChamber owns its own error (D43)                     ✅
│   ├── 5.2.3 Threshold ceremony on first entry per token             ○  BUSINESS.md, binding
│   ├── 5.2.4 Auto-fading chrome                                      ◐
│   └── 5.2.5 Range requests for a large PDF on a phone               ○
├── 5.3 Sanctuary
│   ├── 5.3.1 Expired or invalid lands here, not on an error          ✅
│   └── 5.3.2 One-tap reissue to the owner's phone (D9)               ✅
├── 5.4 Progress
│   ├── 5.4.1 opened_at stamped on first open                         ✅
│   ├── 5.4.2 finished state                                          ◐  in the machine, not the UI
│   └── 5.4.3 Resume where I stopped                                  ○
└── 5.5 Home
    ├── 5.5.1 Account block + chapter list, no tokens (D11)           ✅
    ├── 5.5.2 Read / unread mark (D11)                                ✅
    ├── 5.5.3 Locked chapters shown with their unlock date            ○  needs 3.1.2
    └── 5.5.4 More than one book, grouped                             ◐
```

**5.5.3 is the reader-facing half of cadence** and is the reason 3.1.3 (compute every `unlock_at`
at order time) is the right choice: Home can then render the whole schedule without simulating it.

---

### 2.6 COMPANIONSHIP

```
6 COMPANIONSHIP
├── 6.1 Context
│   ├── 6.1.1 pypdf → text_content, page_count                        ✅
│   ├── 6.1.2 Whole chapter in the system prompt, no retrieval        ✅
│   └── 6.1.3 Prompt cache, 1h TTL (D24)                              ○  cost model unimplemented
├── 6.2 Conversation
│   ├── 6.2.1 POST /api/chat, grant-gated (D7)                        ✅
│   ├── 6.2.2 Opens with a question, never a summary (D13)            ○  prompt craft
│   ├── 6.2.3 Never interrupts (D14)                                  ✅  structurally
│   ├── 6.2.4 History held client-side, sent per turn                 ◐  no server transcript
│   └── 6.2.5 Off-topic declines gracefully                           ○  prompt craft
├── 6.3 Limits
│   ├── 6.3.1 Caps in the service, not the endpoint (D33)             ✅
│   ├── 6.3.2 ChatUsage rows are the counter (D31)                    ✅
│   └── 6.3.3 Rate-limited renders as a normal state (D45)            ✅
└── 6.4 Provider
    ├── 6.4.1 Anthropic backend                                       ✅
    ├── 6.4.2 Gemini for testing, same seam (D46)                     ✅
    └── 6.4.3 The prompt itself                                       ○  its own session (D14)
```

**6.2.4 is a structural question, not a leaf:** with no server-side transcript there is no way to
resume a conversation on a second device, and no way for the owner to see what the companion said.
Decide before the prompt is written, because the prompt shape depends on it.

---

### 2.7 STEWARDSHIP — how the owner runs it

```
7 STEWARDSHIP
├── 7.1 Admin
│   ├── 7.1.1 Eight model screens                                     ✅
│   ├── 7.1.2 Resend action                                           ✅
│   ├── 7.1.3 Concierge onboarding through admin (D10)                ◐  now behind D47
│   └── 7.1.4 One screen: "everything about this reader"              ○  the real ops need
├── 7.2 Commands
│   ├── 7.2.1 seed_dev, idempotent                                    ✅
│   ├── 7.2.2 send_chapter                                            ✅
│   ├── 7.2.3 machine_diagram → mermaid                               ✅
│   └── 7.2.4 cadence_tick                                            ○  = 3.2.1
├── 7.3 Content operations
│   ├── 7.3.1 Upload a book and its chapters                          ◐  admin only, no validation
│   └── 7.3.2 Publish / unpublish                                     ✅
└── 7.4 Observability
    ├── 7.4.1 stdout to the host viewer (D22)                         ✅
    ├── 7.4.2 Delivery failure is visible somewhere                   ◐  MessageLog, unsurfaced
    └── 7.4.3 Sentry                                                  ○  deferred (D16)
```

---

### 2.8 The feature tree, ranked

Not everything above is next. Ordered by *what breaks if we skip it*:

| # | Item | Why now |
|---|---|---|
| 1 | **3.1–3.3 Cadence** | the product's first sentence; the machine layer was built for it |
| 2 | **2.1.4 revert phone reuse** | a live security hole; one line |
| 3 | **4.1.3–4.1.4 WABA + templates** | weeks of external waiting; start the clock |
| 4 | **2.4.4 Safari** | a silent total failure of login, invisible on localhost |
| 5 | **5.5.3 locked chapters on Home** | cadence with no reader-facing surface is invisible |
| 6 | **6.2.2 / 6.4.3 the prompt** | the companion currently has no voice |
| 7 | **1.3.5 refund** | money is one-way today |
| 8 | **2.5.1 change phone** | one changed number = one permanently unreachable reader |

---

### 2.9 SURFACE — how it looks, moves, and is found

Not a clause of the promise, like STEWARDSHIP: it is how every clause is presented. It has its
own GitHub milestone, **Surface**. Each leaf's full implementation plan is in its issue; this is
the overview and the order.

**The direction is already set** in `global.css`: warm paper, Fraunces, one sienna accent, "nothing
glows". "Advanced but professional" means going further in that style, not adding gloss on
top of it.

```
S SURFACE
├── S1 Basics every visitor expects
│   ├── S1.1 Site header: back to the library from every page       ○  #118
│   ├── S1.2 Link preview card, favicon, app manifest               ○  #119
│   ├── S1.3 Dark mode: walnut and candlelight, follows the system  ○  #120  ← needs #118
│   ├── S1.4 Legal pages + footer (Razorpay KYC checks for them)    ○  #121  HITL: owner copy
│   └── S1.5 A 404 page that is not the landing page                ○
├── S2 The chamber actually renders
│   ├── S2.1 Verify on Android + iPhone + inside WhatsApp           ○  #117  HITL: real phones
│   └── S2.2 Render pages ourselves with pdf.js                     ○  only if #117 fails;
│                                                                       reopens #31 (STATUS q13)
├── S3 Motion
│   ├── S3.1 Foundation: tokens, View Transitions, grain, Fraunces axes, reduced-motion  ○  #115
│   ├── S3.2 Opening ceremony, first open of each link (server decides)                 ○  #116
│   ├── S3.3 Home as a path; locked rows with seal + date                               ○  #114 (spec in comment)
│   ├── S3.4 Landing: cover tilt, scroll-linked reveals, cadence demo on a phone        ○
│   ├── S3.5 Reader: auto-fading controls, pages fade in, flourish at the end           ◐  5.2.4
│   ├── S3.6 Companion: sheet panel, questions set as margin notes, slow "thinking"     ○
│   └── S3.7 Details: hairline loader, drawn underlines, ink-wash press, sanctuary ribbon ○
└── S4 Later: reading comfort (all easier after S2.2)
    ├── S4.1 Resume where I stopped                                 ○  = 5.4.3
    ├── S4.2 Text size / zoom                                       ○
    ├── S4.3 Highlights and notes, which the companion can use      ○  needs a decision
    ├── S4.4 Typographic cover generated per book                   ○
    └── S4.5 Preview card per book (served per URL)                 ○  after #119
```

**Rules for everything in S3**
- Native first: CSS, the View Transitions API, scroll-linked CSS animations. Add `motion` only if
  a spring or drag genuinely needs it. **Rejected: three.js / WebGL** (page curls, 3D scenes):
  too heavy for the phone every WhatsApp link opens on, and it breaks "nothing glows". Record
  this in #115's decision so nobody proposes it again.
- Animate only position, scale and opacity, so it holds 60 fps on a mid-range Android phone.
- **Nothing moves while the reader is reading.**
- Show dates, never countdowns (D11).
- Any sequence of steps is states in a machine, not a timer chain (mandate 2).
- Copy in `labels.ts`.
- Reduced motion keeps fades and drops movement.

**#117 is the hinge.** If phones cannot show a chapter, S2.2 jumps ahead of all of S3: nothing
can be animated or styled inside the browser's own PDF viewer, and a reader who cannot read will
not notice the polish.

---

## 3. Tree two — the restructuring

### 3.1 The complaint, made specific

> *"When you open the project main file or machine, you should understand whatever is going on."*

There is no such file. `core/machines/registry.py` lists four machines and is the closest thing;
it is four import lines. The frontend **does** have one — `src/pages/machine/machine.ts`, where two
parallel regions and seven page states fit on a screen and the whole app is legible. The backend
has no equivalent, and that asymmetry is the largest single source of the messiness.

### 3.2 Seven findings, with evidence

| # | Finding | Evidence |
|---|---|---|
| **F1** | **The machine layer is 1/4 wired.** D36 says machines are the orchestration layer. Only `reading` has a production caller. | `grep` for the four machines outside `machines/` and `tests/` returns exactly one file: `core/api/grants.py` |
| **F2** | **No root map.** Nothing answers "what does this application do" without reading fifteen files. | `registry.py` is 4 imports; `MACHINES` is used only by the diagram command |
| **F3** | **Flow leaked into the HTTP layer.** The layer that "holds no business logic" holds the most complicated flow in the app. | `core/api/checkout.py` is **320 lines** with **12** `objects.` calls and a private `_fulfil` that is the real onboarding flow |
| **F4** | **Reads have no home.** `api/` queries the ORM because there is nowhere else to put a read. | 19 ORM calls across `api/` — checkout 12, reset 4, home 3 |
| **F5** | **Two vocabularies.** Endpoints speak HTTP verbs; machines speak events; services speak function names. The same act has three names. | `POST /chapters/{id}/send` → `whatsapp.send_chapter` → no event at all |
| **F6** | **No enforcement.** Every rule in both `CLAUDE.md` files is a convention a reviewer must remember. | **no linter in the repo** — no ruff, no eslint config, no mypy; CI runs `check`, `makemigrations --check`, `test` |
| **F7** | **Documentation drift, again.** The failure mode V2 exists to prevent. | `STATUS.md` 3 weeks and 95 PRs stale · `ALL_DOCUMENTATION.md` + `UNIFIED_SPEC.md` still present, ~3,400 stale lines · `DESIGN.md` said `MessageLog >── User, TemporalGrant`, `apps/api/CLAUDE.md` said `>── User, Chapter` (fixed) |

**F1 and F3 are the same finding seen from two ends.** The flow exists twice: once as a transition
table nothing calls, and once as `if`/`raise` inside an endpoint.

### 3.3 The principle

**Make the backend readable the way the frontend already is.**

The frontend got this right and is worth copying exactly:

| The frontend has | The backend needs |
|---|---|
| `pages/machine/machine.ts` — the root, on one screen | `core/flows.py` — every process, on one screen |
| `pages/<page>/` — everything about one page together | `core/domains/<domain>/` — everything about one capability together |
| the 6-file split, one location, no exceptions | the same split, same names, same order |
| `Navigator` renders one page per state | the flow registry maps one entry point per event |

One mental model for the whole monorepo. A person who has read `apps/web/src` can read
`apps/api/core` without being told anything new.

### 3.4 The target — backend

```
apps/api/core/
│
├── MAP.md                     ← open this first. One page. What the app does.
├── flows.py                   ← THE ROOT. Every process, as data. Verified by a test.
│
├── domains/                   ← one folder per capability in §2
│   ├── acquisition/           "a reader buys a book"
│   │   ├── machine.py             states + transition table  ── THE FLOW
│   │   ├── guards.py              one question each
│   │   ├── actions.py             one effect each
│   │   ├── service.py             the effects: create_reader, payments   ── THE SEAMS
│   │   ├── selectors.py           the reads                              ── NEW (F4)
│   │   ├── api.py                 HTTP only: request → event → status
│   │   ├── schemas.py             Ninja in/out
│   │   └── tests/
│   ├── identity/              ── auth, reset, the account
│   ├── cadence/               ── the tick, the schedule          ── NEW (§2.3)
│   ├── delivery/              ── WhatsApp, MessageLog
│   ├── reading/               ── grants, PDF bytes, home
│   └── companionship/         ── chat, caps, extraction
│
├── platform/                  ← shared, domain-free, boring
│   ├── machines/                  Spec · dispatch · Ctx · binding · diagram
│   ├── auth/                      SessionAuth · GrantAuth
│   ├── content/                   templates.py · companion_prompt.md
│   ├── phone.py · links.py
│   └── ninja.py                   the NinjaAPI instance + router registration
│
├── models.py                  data only, still one file
├── admin.py                   screens only; every action calls a service
└── management/commands/
```

**Rules, unchanged in substance, now visible in the tree:**

- Layering is now a **file-name** rule, not a folder rule: `machine.py`/`guards.py`/`actions.py` =
  flow, `service.py`/`selectors.py` = effects, `api.py`/`schemas.py` = edge. Same four layers,
  same prohibitions, read left-to-right inside one folder instead of across four.
- **Still one Django app.** `domains/` are modules, not apps. Same `app_label`, **zero migration
  impact** — this is a pure file move.
- `core/machines/` → `core/platform/machines/`: the framework was never domain logic, and putting
  it beside four machine *instances* is what made the layer look bigger than it is.
- **`selectors.py` is new** and is the answer to F4. Reads leave `api/` and land somewhere named.
  Borrowed from the HackSoft styleguide (§4.2), narrowed: selectors are the only place a read query
  is written, services are the only place a write is.

### 3.5 `flows.py` — the root map, and why it cannot drift

A declarative registry, shaped like the frontend's root machine:

```python
FLOWS = [
    Flow(
        name="acquisition",
        sentence="A visitor pays, and becomes a reader who owns a book.",
        subject="a purchase attempt",
        machine=acquisition_machine,          # states + table, or None
        entrypoints=[
            "POST /api/checkout",
            "POST /api/razorpay/webhook",
            "GET  /api/checkout/confirm",
            "admin: create reader",
        ],
        seams=["onboarding.create_reader", "whatsapp.send_chapter"],
        writes=["User", "Order", "TemporalGrant", "MessageLog"],
    ),
    ...
]
```

Seven rows. One screen. `manage.py map` renders it as the tree in §2 plus a mermaid diagram per
machine, straight from the same data the code runs on.

**What makes it stay true — one test:**

```
every registered Ninja route appears in exactly one Flow.entrypoints
every Spec in the codebase is referenced by exactly one Flow
every function named in Flow.seams exists and is importable
```

An endpoint added without a home fails CI. That is the difference between a map and a diagram
nobody updates — and it is precisely the failure that produced V1's three competing specs.

### 3.6 Wire, or delete — the four machines

F1 forces the question, and D36 wrote its own answer: *"Revisit if the tables start describing a
single linear path with no branches."*

| Machine | States | Branches | Verdict |
|---|---|---|---|
| `reading` | 3 | 4 rows, cadence adds more | **keep** — wired, correct |
| `onboarding` | 2 | **4 rows, order-dependent** — D26's four identity cases | **wire it.** It already encodes what `checkout.py::_fulfil` re-implements in `if`s. This is the single largest legibility win in the backend |
| `delivery` | 3 | 3 rows on one event, outcome-guarded (D40) | **wire it.** `whatsapp._deliver` already branches on the same outcomes; the table is the honest version |
| `auth` | 2 | linear, no guards | **delete it.** D36's own revisit clause, met exactly. Two states and no branch is a function |

Deleting one of four machines is not a retreat from D36; it is D36 being applied. Record it.

### 3.7 The target — cadence's shape (decide before building)

Two candidates, and the tree above assumes the first:

**A. Compute every `unlock_at` at order time.** `create_reader` mints one grant per chapter, all
dated. The tick asks "which grants are due and still `scheduled`?" — a single indexed query.
Home renders the whole schedule for free (5.5.3). Changing pace (3.4.1) is an update over future
rows. **Recommended.**

**B. Compute on the fly at tick time.** Walk open orders, derive the due chapter from
`created_at + (N-1)×interval`, mint then. Fewer rows; Home has to re-derive the schedule to show
it, and two places then compute the same date — which is the duplication D36 exists to remove.

A costs N rows per order (N ≤ ~20). B costs a second implementation of the schedule. Take A.

### 3.8 The target — frontend

Smaller, because the frontend is in good shape. Three changes:

```
apps/web/src/
├── app/                      ← NEW. Level 0, named after what it is (D15)
│   ├── Navigator.tsx             was pages/index.tsx — the root component was hiding in a barrel
│   └── machine/                  was pages/machine/ — the root machine
├── pages/<page>/             ← Level 1. Unchanged.
├── components/<Comp>/        ← Level 2. Unchanged.
└── lib/
    └── labels/               ← NEW. One file per domain, mirroring §2
        ├── index.ts              composes them; locale.ts unchanged
        ├── acquisition.ts        landing, checkout, welcome
        ├── identity.ts           login, reset, set-password
        ├── reading.ts            home, chamber, sanctuary
        └── companionship.ts      the panel
```

1. **`src/app/`** — D15 names three levels; the tree shows two. Level 0 currently lives in
   `pages/index.tsx` and `pages/machine/`, i.e. inside level 1.
2. **`labels/` split** — 179 lines and growing, and copy is edited by someone who is not a
   developer. Splitting by domain means the person editing checkout copy opens `acquisition.ts`.
   The mandate ("zero hardcoded strings") is untouched; only the file boundary moves.
3. **Six files, everywhere, no exceptions.** `PdfChamber/machine/` has no `guards.ts`;
   `landing/machine/` has no `guards.ts`. Either add them or record that guardless machines omit
   it — but say which, once, in `apps/web/CLAUDE.md`.

### 3.9 The target — documents

| Action | File | Why |
|---|---|---|
| **delete** | `ALL_DOCUMENTATION.md`, `UNIFIED_SPEC.md` | ~3,400 lines of stale copies. `STATUS.md` has said to delete them since August. Duplication is what killed V1 |
| **rewrite** | `STATUS.md` | 95 PRs stale. Rewrite against §1, then keep it to state + actions, as its own header demands |
| **amend** | `DESIGN.md` §6 roadmap | Phases 0–5 are built; the table describes a project that does not exist. Replace the phase table with a pointer to this file's §2 |
| ~~fix~~ **done** | `apps/api/CLAUDE.md` | `MessageLog` FKs contradicted `DESIGN.md`. The model has `user` + `grant`, so `apps/api/CLAUDE.md` was wrong. Corrected 2026-09-23 |
| **add** | `apps/api/core/MAP.md` | the one-page answer to "what does this app do" |
| **amend** | `apps/api/CLAUDE.md` | file structure section, once §3.4 lands |
| **amend** | `apps/api/BUILD.md` | S0–S11 with gates G1–G6 all closed; it describes a build already done |
| **new decisions** | `decisions/12-structure.md` | **D49** domain-first layout · **D50** `flows.py` as the root map, verified by test · **D51** layering enforced by lint + test, not review · **D52** cadence shape (§3.7) · **D53** retire the `auth` machine |

### 3.10 The target — enforcement (F6)

Conventions a reviewer must remember are conventions that erode. Four checks, all cheap:

| Check | Tool | Catches |
|---|---|---|
| `machines/` imports no Django | test walking the AST | D37, the portability claim |
| `api/` imports no model directly | test walking the AST | F3, F4 |
| every route has a `Flow` | test over the registry | F2, drift |
| style, unused imports, `as any` | **ruff** (api) + **eslint** (web), in CI | F6 — there is no linter at all today |

The first three are ~40 lines of test each and are the ones that matter: they turn `CLAUDE.md`'s
prose into something that fails.

---

## 4. What the research changed

Four questions were open when this started. The web answered three.

### 4.1 Is `transitions` still the right library? — **Yes, keep it (D37 stands)**

`python-statemachine` 3.2 has genuinely moved ahead: compound (nested) states as nested classes,
parallel regions, history states, diagram generation on every instance, and a Django integration
that auto-discovers `statemachines.py` per app with a `MachineMixin` binding state to a model
field. That is closer to XState than `transitions` is, and the symmetry with the frontend is
tempting.

**Rejected anyway, for now.** D37 chose `transitions` for `model=` binding to *any* plain object
and for keeping Django out of the layer; `python-statemachine`'s Django integration works by
pulling Django *in*, which is the opposite of what D37 protects. Our tables are flat — no machine
here needs a compound state — so the headline feature buys nothing today.

**Revisit if** cadence needs nested states (e.g. `live` containing `unread`/`reminded`), which is
plausible within two features. Record it as the trigger, in D49's revisit block.

### 4.2 Where do reads go? — **`selectors.py`** (HackSoft)

The HackSoft styleguide splits `services.py` (writes) from `selectors.py` (reads) and forbids
business logic in APIs, serializers, `save()`, managers, and signals. We already forbid it in APIs
and have services; we never named the read side, which is exactly why 19 ORM calls are sitting in
`core/api/`. Adopt the name and the rule; skip the rest of the styleguide, which assumes DRF.

### 4.3 Product ideas worth stealing — three, and one warning

- **Show the schedule, not just the next chapter** (drip platforms universally do this). Feeds
  5.5.3 and is most of why §3.7 recommends option A.
- **Quiet hours and a per-day ceiling.** Meta throttles marketing templates at roughly two per
  user per day across *all* businesses, and the guidance is a ≥24h gap. With cadence sending
  automatically, 4.5.2 stops being politeness and becomes a deliverability constraint.
- **The companion category has converged on "ask, don't summarise"** — spoiler-free, context-bound,
  Socratic. D13 and D14 already say this; the research confirms the product instinct rather than
  changing it. The differentiator left is *pacing*: a companion that has read exactly as far as
  you have. Nothing else on the market is built around a chapter-scoped window because nothing
  else controls the cadence. **That is the moat, and it needs cadence to exist.**
- **Warning:** every platform in this space treats drip as a marketing sequence. Ours is the
  product. Do not import their re-engagement patterns (streaks, nudges, progress bars) — D14 and
  `BUSINESS.md`'s "no timers, no progress bars, no nudges" forbid them, and they would be the
  easiest thing to add by accident once reminders exist.

### 4.4 Still open after research

**6.2.4 — is there a server-side transcript?** Nobody else's answer transfers: the market splits
on it, and ours depends on whether the owner should be able to read what the companion said. That
is a product question for the human, not a research question. Listed in §6.

---

## 5. Self-review

Read back critically. Five objections, answered.

**"§3 is a refactor with no user-visible output. That is exactly the work that eats a project."**
Fair, and it is why §6 interleaves rather than sequences: R0–R2 are additive and cost about a day
between them, cadence (the highest-value feature) comes *before* the big file move, and R5 is a
pure `git mv` with zero logic change. If only R0–R2 ever land, the repo is still better and nothing
is half-migrated.

**"§3.4 contradicts `apps/api/CLAUDE.md`, which specifies the layer-first tree."**
It does, and that file is amended by D49 rather than quietly diverged from. Worth being explicit:
the layer-first tree was right when `services/` had three files. It stopped being right at eight
services, eight routers and four machines, because the question people ask changed from "where does
logic go?" to "where is everything about buying a book?"

**"Deleting the `auth` machine after it was built and tested is waste."**
It is, and the waste already happened. D36 accepted "two of the five machines are thin at today's
scope" as a *cost*; the revisit clause names exactly this. Keeping a machine to justify having
built it is how V1 accumulated three reading-room implementations.

**"The tree in §2 marks things ✅ that were never demoed on the deployed instance."**
True, and it is the weakest part of this document. D5 says a phase is done when its demo is true
*in production*. Every ✅ here means "built, merged, tested" — not "demoed." §6 therefore opens with
a verification pass, and it is deliberately the first item.

**"Seven capabilities and six domains — the mapping is off by one."**
Stewardship (§2.7) has no domain folder, because it is not a capability but a *view onto* the other
six: admin screens, commands, logs. It stays in `admin.py` and `management/commands/`, which import
from every domain. If it ever grows its own logic, that is the signal it earned a folder.

**One thing this plan does not do:** it does not touch `models.py`. Eight tables in 438 lines is
still legible, splitting is free later (same `app_label`, no migration), and doing it during a
folder move would make the diff unreviewable. Deliberate.

---

## 6. Sequence

Every code item is a GitHub issue → branch `<n>-<slug>` → one PR → merge. Markdown is exempt and
lands directly.

### Now — nothing depends on these, and they cost little

| | Item | Kind | Notes |
|---|---|---|---|
| **V0** | **Verify what §2 claims.** Walk the deployed instance: log in, read a chapter, chat, recover a link. Correct every ✅ that is only "merged" | verification | §5, objection 4. **Do this first** |
| **R0** | Delete `ALL_DOCUMENTATION.md` + `UNIFIED_SPEC.md`; rewrite `STATUS.md` (`MessageLog` fix already done) | markdown | direct to main |
| **F0** | Revert `ONBOARDING_ALLOW_PHONE_REUSE` (2.1.4) | issue | one line, live hole |
| **A0** | Start the WABA application + submit four templates; start Razorpay KYC | external | weeks of waiting; start the clock |

### Next — structure, additive only

| | Item | Depends on |
|---|---|---|
| **D49–D53** | Write the decisions (§3.9) before any of R1–R5 | — |
| **R1** | `core/flows.py` + `MAP.md` + `manage.py map` + the drift test (§3.5) | D50 |
| **R2** | The three AST tests + ruff + eslint in CI (§3.10) | D51 — **expect R2 to fail on F3/F4; that is the point** |

### Then — the highest-value feature, before the big move

| | Item | Depends on |
|---|---|---|
| **F1** | Cadence: `unlock_at` at order time, `cadence_tick`, UNLOCK wired (3.1–3.3) | D52 |
| **F2** | Home shows locked chapters and their dates (5.5.3) | F1 |
| **F3** | Unread reminder (4.2.4) | F1 + an approved template |
| **F4** | Quiet hours + per-day ceiling (4.5.2) | F1, §4.3 |

### Then — the move, now mechanical

| | Item | Depends on |
|---|---|---|
| **R3** | Pull the 19 ORM calls out of `api/` into `selectors.py` | R2 named them |
| **R4** | Wire `onboarding` and `delivery`; delete `auth` (§3.6) | R3 — this is what shrinks `checkout.py` |
| **R5** | `git mv` into `domains/` + `platform/` (§3.4) | R3, R4 — pure move, no logic |
| **R6** | Frontend: `src/app/`, `labels/` split, six files everywhere (§3.8) | independent of R1–R5 |

### Surface: runs alongside the tracks above (§2.9, milestone **Surface**)

Frontend almost entirely, so it does not collide with R1–R5. Settle #117 first; everything else
here assumes its answer.

| | Item | Issue | Depends on |
|---|---|---|---|
| **S-a** | Verify the chamber on real phones | #117 | a person with an Android and an iPhone |
| **S-b** | Site header | #118 | — |
| **S-c** | Link preview + favicon + manifest | #119 | `VITE_APP_URL` on Vercel |
| **S-d** | Dark mode | #120 | #118 (the toggle's slot) |
| **S-e** | pdf.js renderer, *only if S-a fails* | not opened | S-a; goes **ahead of** S-f |
| **S-f** | Motion foundation + its decision record | #115 | — |
| **S-g** | Opening ceremony | #116 | #115 |
| **S-h** | Home as a path, locked rows | #114 | F1 (#112) · #115 optional |
| **S-i** | Legal pages + footer | #121 | owner's business details; **before KYC review** |
| **S-j** | S3.4–S3.7, then S4 | not opened | #115 |

### After

2.4.4 Safari · 1.3.5 refund · 2.5.1 change phone · 6.2.2 + 6.4.3 the prompt · 7.1.4 the reader
screen.

### Questions only the human can answer

1. **The domain name.** Still the only item blocked on a person; templates embed the URL.
2. **6.2.4 — server-side transcript?** Decide before the prompt is written (§4.4).
3. **3.4.3 — "send me the next one now."** Does an escape hatch from cadence betray the product, or
   is refusing it precious? D14's posture suggests refusing; worth saying out loud once.
4. **§3.4 — adopt domain-first at all?** Everything from R3 down assumes yes.
