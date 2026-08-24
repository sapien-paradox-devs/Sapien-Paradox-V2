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

### Open, and deliberately not decided here

- **Currency and units.** `Book.price_cents` is named for cents; rupees are stored in paise.
  Rename or document — but decide before the first real price is entered.
- **Does a public signup page now exist?** D10 says no public signup exists *until payments land*.
  This is that moment, so D10's precondition is expiring. That reversal deserves its own decision
  rather than arriving as a side effect.
- One-time purchase versus subscription.
- GST and invoicing obligations for an Indian business.
