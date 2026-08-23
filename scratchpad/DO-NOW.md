# Do now

A live checklist, not a plan. The reasoning behind it is in
`2026-08-23-next-requirements.md`; canonical state is `STATUS.md`.

Split by who can actually do it. Most of the project is mine; this list exists because a handful
of things genuinely aren't.

---

## You — today · ~1 hour · ~$10

### 1. Disable the R2 public dev URL · 2 min

R2 → your bucket → Settings → Public Development URL → **Disable**.

That URL serves every object in the bucket to anyone who knows the key — no token, no expiry, and
requests never reach our API, so nothing we build can revoke or even see them. Django reads objects
with an API token instead, which is a different door.

*If the PDFs you uploaded are real book content rather than test files, re-upload them under fresh
names afterwards. The old keys were publicly reachable.*

### 2. Create an R2 API token and fill in `.env` · 5 min

R2 → API → Manage API Tokens → Create token · permission **Object Read & Write** · scoped to that
one bucket.

```bash
cd apps/api && cp .env.example .env
```

```
AWS_STORAGE_BUCKET_NAME=<bucket name>
AWS_ACCESS_KEY_ID=<access key id>
AWS_SECRET_ACCESS_KEY=<secret access key>
AWS_S3_ENDPOINT_URL=https://<account-id>.r2.cloudflarestorage.com
AWS_S3_REGION_NAME=auto
```

`.env` is gitignored. **Don't paste the secret into chat.** Bucket name and Account ID are not
credentials and are fine to share.

Also useful: **the key names of the two PDFs you uploaded**, so seeded chapters can point at real
objects and prove the streaming path.

### 3. Register the domain · 20 min · ~$10/yr

Cloudflare Registrar, sold at cost.

**This is the root of the longest chain in the project.** Every WhatsApp template embeds the URL,
Meta reviews templates with their real links, and Meta review takes days to weeks. Nothing else on
any list is as expensive to defer, because the cost is calendar time rather than work.

Everything else on Cloudflare — R2, DNS, Pages — is free at our scale. This is the only bill.

### 4. Answer one question · 2 min

**Where is the business registered, and where are your readers?**

It picks the payment provider — Stripe vs Razorpay/Cashfree — and their KYC clock is also
days-to-weeks. It's the only other open question blocked specifically on you.

---

## You — this week, once the domain exists

- [ ] **Twilio account** → apply for a WhatsApp Business Sender
- [ ] **Review the four template copies** I'll draft, then submit them to Meta together
- [ ] Start payment-provider KYC

Submit all four at once — chapter delivery, fresh link, unread reminder, password reset. An
approved unused template costs nothing and keeps cadence off Meta's critical path later (D12).

---

## Me — starting now

- [ ] Open the twelve slice issues *(gate in front of all remaining code)*
- [ ] **The eight tables** — models, admin, migration. Blocked by nothing
- [ ] Draft the four WhatsApp templates with a placeholder domain for you to swap
- [ ] Verify the R2 connection once `.env` exists — list the bucket, stream one object
- [ ] Grill the three seams (gate G3) — the last piece of design that needs a real session

---

## Waiting on your say-so

- [ ] **Delete `ALL_DOCUMENTATION.md` and `UNIFIED_SPEC.md`** — 3,400 lines of stale concatenated
      copies of the six real documents
- [ ] Deploy to Render + Pages — better done once the domain exists, so the session cookie is
      configured correctly the first time rather than twice

---

## Not blocking anything

- [ ] Amend D20 — `as const` doesn't preserve literal unions on JSON imports; the union is declared
      in `src/lib/constants.ts` with a load-time assertion instead
