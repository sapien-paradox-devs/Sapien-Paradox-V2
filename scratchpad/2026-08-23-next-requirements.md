# 2026-08-23 — where we are, and what's next

Working note. Canonical state is `STATUS.md`; this is the detail behind it and the drafts that
haven't been promoted yet.

---

## Where we are, honestly

**The repo is real and both apps run.** That is the whole of it. Three commits, CI green, a health
endpoint, one model.

The gap worth naming: **eight months of design, one day of code.** Twenty-four locked decisions,
five specification documents, and what exists is a Django skeleton and a React shell. That is not a
failure — it was the plan, and V1 failed the other way round — but from here the ratio has to
invert. Every remaining document is now a liability until it has code under it.

**The oldest unpaid debt is deployment.** D5 says deploy first, with real external dependencies,
*before there is much to deploy*. There is now something to deploy and it hasn't been. Every day
that slips makes the eventual "retrofit object storage after content exists" scenario more likely
— which is the exact thing D5 was written to prevent.

**Nothing external has been started.** Six services, zero accounts. The Meta template review is
days to weeks and it gates the demo. It is also the only item on the list where *waiting* is the
work, so it is the cheapest thing to start and the most expensive to defer.

---

## Immediate next requirements

Ordered by what unblocks the most.

### 1. Open the issue backlog *(blocks all code)*

Under the new workflow nothing code-shaped starts without an issue. Twelve slices drafted, none
approved, none opened. This is a ten-minute task standing in front of everything else.

Open question for you: **all twelve now, or the first three and grow it?**

### 2. Register the domain *(blocks Track A entirely)*

Every WhatsApp template embeds the URL, and Meta reviews the template with its real link — so the
domain has to exist before the templates can be submitted, and the templates have to be approved
before the demo. It is the first link in the longest chain in the project.

Cloudflare, ~$10/year, an hour of work. **Not chosen yet.**

### 3. Draft the four WhatsApp templates *(the long pole)*

Chapter delivery · fresh link · unread reminder · password reset. Submitted together — an approved
unused template costs nothing and keeps cadence off Meta's critical path later (D12).

I have offered to draft these several times across sessions and they remain unwritten. They are
maybe an hour of copy, and they are the single largest source of calendar risk.

### 4. Grill the three seams *(gate G3 — blocks every service function)*

The one remaining piece of design that genuinely needs a session rather than a paragraph.

Questions I'd open with, in BFS order:

**`access.can_read(user_or_token, chapter)`**
- Does it take a `User` or a `TemporalGrant`, or both? The chat endpoint has no session, so the
  token path is not optional.
- Does it return a boolean or raise? A boolean makes every caller write the same `if not …: 403`.
- Does it check `unlock_at` today, given cadence is deferred and the field is always null?

**`onboarding.create_reader(name, email, phone, book, pace)`**
- What happens when the email exists but the phone is new — a distinct error, or reuse the user?
  Both fields are unique, so this is a real branch, and concierge onboarding will hit it.
- Delivery is post-commit. If the WhatsApp send fails after the transaction commits, the reader
  exists with no link. Is that an admin's problem to notice, or does the caller get told?

**`whatsapp.send_chapter(grant)`**
- Does it take a grant, or a user plus a chapter and mint internally? D12 says grant — worth
  confirming, because it forces every caller to mint first.
- It is named `send_chapter` but D16 also routes password reset through WhatsApp. Is that a second
  function, or is this one misnamed?

### 5. Deploy both apps *(pays down D5)*

Render for `apps/api`, Cloudflare Pages for `apps/web`. Both build commands are verified locally.
Needs the domain first for the cookie to be configured correctly, but could go up on vendor
subdomains immediately to prove the pipeline.

---

## Smaller things, already recorded

- **Delete `ALL_DOCUMENTATION.md` and `UNIFIED_SPEC.md`** — 3,400 lines of stale concatenated
  copies. Waiting on your say-so.
- **Amend D20** — `as const` does not preserve literal unions on JSON imports.
- **Payment provider** — still blocked on where the business is registered and where the readers
  are.

---

## What I'd do next if left alone

Open the twelve issues, then draft the four WhatsApp templates with a placeholder domain for you
to swap in. Those two together unblock the most and cost you the least — the first is mechanical,
the second is the only work that buys back calendar time.
