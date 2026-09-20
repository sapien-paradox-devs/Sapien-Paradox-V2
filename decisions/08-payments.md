# Payments

D28

---

## D28 — Razorpay

**Locked** 2026-08-25 · closes the payment-provider question open since 2026-08-09

Razorpay is the payment provider. It was the last of the two questions blocked specifically on the
owner (`STATUS.md` #4).

### Why

The business and its readers are in India, and that settles it on payment *methods* rather than on
developer experience. Indian buyers overwhelmingly pay by UPI, and after that by netbanking,
cards, and wallets. A card-only checkout would lose a large share of them at the last step — the
most expensive place in the funnel to lose anyone.

**Rejected — Stripe.** Better documentation, better international coverage, and a nicer webhook
model. It loses on the only axis that decides this: UPI support in India is not comparable, and the
product's buyers are Indian.

**Revisit if** the readership turns out to be substantially outside India. That would be a real
reversal, not a tweak, so it should be triggered by evidence rather than by preference.

**Cost:** roughly 2% on domestic transactions, higher internationally. Confirm the exact rate at
signup rather than trusting this line — published rates move.

**Lead time:** KYC takes days to weeks. It is the second-longest wait in the project after Meta's
template review, and the two run independently, so both should start now.

**Test keys are instant.** The whole integration is buildable and testable before the account is
approved, which is why this decision does not block anything today.

### What it does not change

**Nothing about how a reader comes into existence.** `onboarding.create_reader(...)` is already the
only door (D10, D26), and a Razorpay webhook calls that same function. Same four identity-collision
cases, same transaction boundary, same delivery of chapter one and the set-a-password link. This is
the seam paying for itself: payments arrive as a new *caller*, not a new flow.

**Nothing about revocation.** A refund removes the entitlement, and because `can_read` re-checks the
`Order` on every request and PDF bytes are proxied rather than served by signed URL (D23), access
stops immediately rather than at the end of some URL's lifetime.

### What it adds later

`Order` gains a payment identifier, a status, an idempotency key, and refund state — **added when
their real shape is known, not guessed now.** D19 deliberately dropped V1's `stripe_session_id`
precisely because it was unique *and* required, which made a concierge-created order impossible to
save. The same mistake in Razorpay's clothing is the thing to avoid.

### Consequences to handle in the payments segment

- **The webhook is not a normal endpoint.** No session, no CSRF, signature verified against the
  webhook secret, and **idempotent** — Razorpay retries, so the same event will arrive twice.
- **No queue** (D17), so the webhook does its work synchronously and must stay fast.
- **A paying reader still has no password** (D26). Checkout completing is not an account; the
  set-a-password link over WhatsApp is what makes it one.

### Inherited from V1 — a validated spike and a locked spec

**V1 got further than "Stripe".** Two assets carry over, found 2026-09-09 after this decision was
first written:

- **`spikes/razorpay/`** (2026-08-29, ~430 lines, stdlib only) — a throwaway harness that hit the
  **live Razorpay test API** before any Django code was written. It confirmed: INR with `amount`
  in paise is accepted; a hosted **Payment Link** returns a redirectable `short_url`; `notes`
  carries our six signup fields and echoes them back intact; and `callback_url` accepts
  `localhost`, so the redirect leg needs no tunnel.
- **Ticket 017** — a grilling-locked spec for replacing Stripe with Razorpay, including event
  shape (`payment_link.paid`), signature verification via
  `razorpay.Utility.verify_webhook_signature` against `X-Razorpay-Signature`, and the decision to
  name the column neutrally rather than after the gateway.

**Lift both.** The gateway-facing half is already de-risked against the real API; re-deriving it
would be waste.

**What the spike does NOT prove**, and what therefore remains real work: webhooks (Razorpay POSTs
to a publicly reachable URL, so `localhost` fails there — either a tunnel for manual testing or, in
CI, a unit test posting a hand-signed payload), signature verification, idempotency, and the atomic
transaction.

**V1's Stripe path was merged**, and its *fulfilment* half — atomic User + Order + grant,
post-commit best-effort WhatsApp, idempotency on the session id — is correct and is the same shape
as D26. Only the gateway-facing half is Razorpay-specific.

**Follow V1?** ☑ yes, for the spike's findings and 017's gateway spec. ☐ no, for its column naming
— V2 has no payment columns at all yet (D19).

### Answered by the spike

- **Units: paise.** The spike sent `amount: 1000` for ₹10 and Razorpay accepted it. So the smallest
  unit matches `Book.price_cents`'s intent but not its name. **Rename the field to
  `price_minor_units`** rather than storing rupees — 017 reached the same conclusion for its own
  column and noted the rename is one word in a `CharField` plus one migration, while the alternative
  is paying that bill again at the next gateway change.
- **`notes` is the metadata channel**, capped at 15 string keys — enough for the six fields V1
  locked (`email`, `password_hash`, `full_name`, `phone`, `book_slug`, `pace`).

**Worth knowing:** Razorpay can send the *payment link itself* over WhatsApp natively
(`notify.whatsapp`). Unrelated to chapter delivery, which stays on Twilio (D12), but it exists.

### Open, and deliberately not decided here

- **`password_hash` in `notes` is inherited from V1 and should be challenged.** It puts a credential
  in a third party's metadata store. D26 already gives paying readers an unusable password plus a
  set-a-password link over WhatsApp, which removes the need to carry a password through checkout at
  all.
- **Does a public signup page now exist?** D10 says no public signup exists *until payments land*.
  This is that moment, so D10's precondition is expiring. That reversal deserves its own decision
  rather than arriving as a side effect.
- One-time purchase versus subscription.
- GST and invoicing obligations for an Indian business.

---

## D47 — Public signup, and payments lead onboarding

**Locked** 2026-09-19 · **reverses D10's "no public signup"** · **advances D28's sequencing**

A visitor can buy a book from a public page, and paying is what creates them as a reader:

```
landing  →  signup  →  Razorpay  →  create_reader  →  WhatsApp link  →  chamber
```

### What this reverses

**D10** said readers are created by concierge onboarding, and that no public signup exists
*"until payments land"*. That precondition has now expired — this is payments landing. Concierge
onboarding **remains**, because the admin path is still how a reader is created by hand, and
`create_reader` is still the only door. What changes is that it gains a second caller.

**D28** sequenced payments later and named `onboarding.create_reader(...)` as the seam a webhook
would eventually call. The seam was built and tested in #86; this is the caller arriving. Nothing
about the seam changes — same four identity-collision cases, same transaction boundary, same
delivery outside it. **This is the seam paying for itself**, exactly as D28 predicted: payments
arrive as a new *caller*, not a new flow.

### Why now rather than later

The prototype bench proved every leg against live test APIs — a real Payment Link, a real signed
webhook, a real WhatsApp delivery to a real handset. Leaving that proven and unused while the
product has no way for anyone to buy anything was the larger cost.

### What it does not change

**Nothing about access.** `can_read` still asks whether an `Order` exists. A paid reader and a
concierge-created one are indistinguishable downstream, which is the point.

**Nothing about the password.** A paying reader still has no usable password (D26). Checkout
completing is not an account; the set-a-password link over WhatsApp is what makes it one. Crucially
this means **no password is collected at checkout**, so nothing needs to carry a credential through
Razorpay's `notes` — a practice D28 already flagged as wrong when it inherited it from V1.

### Rejected

**Keeping signup private and taking payment out of band** (an invoice, a transfer, then concierge
creation). Honest, and it defers this decision. Rejected because it makes every sale manual work,
which is the opposite of what payments are for.

**A signup page that creates the reader and charges afterwards.** Rejected: an unpaid `Order` is
an entitlement, and `can_read` would start needing to ask about payment status — which is precisely
the complexity the seam exists to keep out of it.

### Revisit if

Readers turn out to arrive overwhelmingly through concierge onboarding anyway, in which case the
public page is maintained for nobody.

---

## D48 — Fulfil on the redirect as well as the webhook *(refines D47)*

**Locked.**

Both legs of the Razorpay return fulfil. `GET /welcome` carries
`razorpay_payment_link_id`, hands it to `POST /api/checkout/confirm`, and that endpoint
creates the reader. The webhook keeps doing the same. Whichever arrives first wins; the
second is a no-op.

### Why

V1's `spikes/end-to-end/` worked, and this is how. Its header names both paths —
*"GET /welcome — post-payment landing; fulfils and tries to message"* and
*"POST /razorpay/webhook — the authoritative fulfilment path"* — and `flow.fulfil()`
takes a `source` argument precisely so either may call it. The record from its working
run says `"fulfilled_by": "redirect"`. **The webhook never did the work.**

V2 shipped only the webhook, and that leg needs four things to all hold at once: a
publicly reachable URL, a webhook registered in the dashboard, `RAZORPAY_WEBHOOK_SECRET`
matching it, and an instance that is awake. On Phase 0 none of them is guaranteed —
`render.yaml` declares no `RAZORPAY_*` variables at all, and D35 puts the API on a free
plan that sleeps after 15 minutes. When any one fails, `signature_is_valid` returns
False on `if not secret`, the endpoint 400s before parsing, and the reader sees a success
page while nothing whatsoever has been created. That is not hypothetical: it happened to
a real payment, and Twilio's log shows no send was ever attempted.

The redirect leg needs none of those four. The reader's own browser delivers it.

### Why it is safe to run both

Idempotency on `Order.payment_reference`, which already exists for the webhook's own
retries — Razorpay resends on any non-2xx and on timeout, so the second delivery has
always had to be a no-op. Two legs is the same property with a different caller.

### The one place we do not copy the spike

The spike trusted `?phone=` from the query string. In production that is forgeable: anyone
could call `/welcome?phone=…` and mint themselves a book. `confirm` therefore **fetches the
payment link from Razorpay and requires `status == "paid"`** before it creates anything. The
query parameter selects *which* link to check; it is never evidence of payment.

### Rejected

**Polling the webhook from `/welcome`.** Waits on the leg that is broken, and turns a 200ms
page into an indefinite one — the reason `WelcomePage` had no spinner to begin with.

**Trusting the callback's own `razorpay_payment_link_status`.** Razorpay appends it, and it is
a query parameter like any other. Forgeable.

**Recording a pending purchase at checkout, as the spike did.** An unpaid row is an
entitlement, which D47 rejected for exactly this reason. Razorpay already stores everything
`confirm` needs, in `notes` — so we read it back rather than keeping our own copy.

### Revisit if

The webhook becomes reliable — a paid plan, the secret set, the dashboard entry registered —
*and* the redirect leg is shown to cause duplicate work in practice. Even then the cost of
keeping both is one extra API call per purchase.
