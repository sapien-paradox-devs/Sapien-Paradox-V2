# External accounts

Five services (D16, D23). What to create, in what order, and what to do with the credentials.

**How to run and deploy is `RUNNING.md`.** This file is only about the accounts themselves.

Credentials go into `apps/api/.env` locally (gitignored) and into the Render dashboard in
production. **Never into a commit, an issue, or a chat window.**

---

## Order matters

```
Cloudflare domain  ──┬──►  Twilio + Meta templates   ← days-to-weeks of review
                     └──►  Render                    ← the API's public address
Anthropic  ──────────────►  (independent, 2 minutes)
```

**The domain is first because everything downstream embeds it.** Meta reviews a WhatsApp template
with its real link in place, and that review is the longest wait in the project.

**Anthropic depends on nothing** — do it whenever.

---

## 1 · Cloudflare — registrar, DNS, storage

**Status: R2 done. Domain not started.**

### Domain

Cloudflare Registrar sells at cost, ~$10/year, no renewal spike. Buy the domain, and DNS is
configured in the same place.

Two records, once Render and Pages exist:

| Name | Points at |
|---|---|
| `api` | the Render service |
| `app` | Cloudflare Pages |

They must be **subdomains of one parent domain**. Unrelated hosts would make the session cookie a
third-party cookie, which Safari and most blockers drop — login would fail on some devices and work
on yours (D6).

### R2 — done

Bucket `sapien-paradox-pdfs`, private, holding two test PDFs. Verified: Django reads an object
server-side and `pypdf` parses it.

> **Keep the public development URL disabled.** It serves every object in the bucket to anyone with
> the key — no token, no expiry — and those requests never reach our API, so nothing we build could
> revoke or even see them (D19).

**Outstanding: rotate the R2 API token.** It passed through a chat window. Two minutes, and it
should happen before real book content goes in.

### Pages — for the interface

New Pages project → connect this repo → root directory `apps/web`, build `npm run build`, output
`dist`, Node 22. Free.

---

## 2 · Render — the API and its database

**~$5–7/month. This is the entire running cost.**

New → Blueprint → select this repo. `render.yaml` provisions both the web service and Postgres and
wires them together. See `RUNNING.md` for what to set afterwards.

> **Never a plan that sleeps.** Free tiers cold-start in roughly a minute, and so do Postgres tiers
> that pause when idle. The core moment of this product is *tap a WhatsApp link → the chapter
> opens*; a reader watching a blank screen for 50 seconds has had the product fail and will never
> know why (D23).

**Render's free Postgres is deleted after 30 days.** It is a trial, not a tier.

---

## 3 · Twilio and Meta — WhatsApp

**The long pole. Days to weeks. Nothing else in the project has a wait like it.**

1. Twilio account
2. Apply for a **WhatsApp Business Sender** — this pulls in a Meta Business account and business
   verification
3. Submit **all four message templates together**

Business-initiated WhatsApp messages must use wording Meta approved in advance. You cannot write
the message at send time.

**Submit all four even though two aren't used yet** (D12) — an approved unused template costs
nothing, and it keeps scheduled delivery off Meta's critical path later.

| # | Template | Used by |
|---|---|---|
| 1 | Chapter delivery | onboarding, admin, CLI, the library's send button |
| 2 | Fresh link | one-tap recovery from an expired link |
| 3 | Unread reminder | not yet built — submitted early on purpose |
| 4 | **Set your password** | new readers *and* password resets |

> **Template 4 must be worded neutrally** — "Set a password for your Sapien Paradox account", not
> "Reset your password" (D26). A concierge-created reader has never had a password, so reset wording
> would be wrong for them; separate templates would mean a fifth submission and a second review
> cycle.

**Until approval lands, everything works.** Delivery falls back to printing the message, so the app
is fully buildable and deployable meanwhile.

**Sandbox note:** Twilio's WhatsApp sandbox works instantly but requires every recipient to text a
join code first. Fine for testing, useless for a real reader.

---

## 4 · Anthropic — the companion

An API key, two minutes, pay-per-token. Nothing to apply for.

Model `claude-sonnet-5`. Budget against $3 / $15 per million tokens.

**Prompt caching with the 1-hour retention is a build requirement, not an optimisation** (D24). The
whole chapter goes into every message's context, so input dominates; caching cuts a conversation
from roughly $0.69 to $0.19. The rhythm of reading is *read a while → ask → read → ask*, and those
gaps routinely exceed five minutes — the default 5-minute retention would expire between questions
and pay full price every time.

Leave the key unset and the companion is unavailable. Nothing else changes.

---

## 5 · Payments — undecided

Blocked on one question: **where is the business registered, and where are the readers?** Stripe or
Razorpay/Cashfree follows from the answer, and their identity checks take days to weeks of their
own.

Nothing in the codebase waits on this — `onboarding.create_reader` is the seam a payment webhook
will call, and it already exists in the design.

---

## Not integrating, on purpose

| | Why |
|---|---|
| Email provider | WhatsApp is the only outbound channel; password reset goes through it (D16) |
| Log service | structured logs to stdout, read in the host's dashboard (D22) |
| Redis / job queue | bounded retry inside the request instead (D17) |
| Error tracking | deferred — revisit before the first reader who isn't you (D16) |
