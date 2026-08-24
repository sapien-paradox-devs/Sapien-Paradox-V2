# The three seams

D25 · D26 · D27

Locked 2026-08-25, by grilling. These are the functions every path routes through, and the
reason payments and cadence are additive later rather than a rewrite. **Nothing bypasses them.**

```
access.can_read(user, chapter) -> bool                    the only access check
onboarding.create_reader(...)  -> OnboardingResult        the only way a reader begins
whatsapp.send_chapter(grant)   -> MessageLog              the only chapter delivery
```

---

## D25 — `access.can_read`: two questions, not one

**Locked** 2026-08-25

### Signature

```python
grants.validate(token) -> TemporalGrant | None     # is this token live?
access.can_read(user, chapter) -> bool             # does this person own the book?
```

**Not** the `can_read(user_or_token, chapter)` the earlier specs described. A polymorphic first
argument means every call site opens with an `isinstance` branch and the body answers two unrelated
questions.

**The two failures need to stay distinguishable.** An expired token means sanctuary — "this link
has rested", one tap to fix (D9). A missing `Order` means 403, and no button solves it. One boolean
collapsing both throws away exactly the information the caller needs to choose a screen.

**A valid token is never sufficient on its own.** Every grant-authenticated request still checks
the `Order`, so a refund or a revoked entitlement takes effect on the *next request*. This is what
makes proxied PDF bytes worth their bandwidth cost over signed URLs (D23) — and it only holds
because ownership is re-checked even when a token is present.

**Cost accepted:** token callers make two calls instead of one.

### Returns `bool`, and never raises

The layering table says `core/services/*` never holds HTTP concerns. A service raising an error
whose entire purpose is to become a 403 has put HTTP in the service layer. Refusals become status
codes at the API layer.

The name argues the same way: `can_read` is phrased as a question, so it answers one.

**Rejected — a result object** (`Access(allowed, reason)`). The real argument for it is cadence:
once chapters unlock on a schedule, "you don't own this" and "this unlocks Tuesday" need different
screens, and a bare `False` can't tell them apart. Rejected anyway because that upgrade is one
function and five call sites, done when cadence actually lands — rather than guessing today what
the reasons will be.

**Cost accepted:** five call sites each write their own 403.

### Knows nothing about unlocking, today

Today it is exactly "does an `Order` exist for this user and this book?". When cadence lands, the
unlock check is added **inside this function** — that is the whole promise of the seam.

**Rejected — a `cadence.is_unlocked()` stub returning `True`.** A second seam inside the first, and
an empty file that looks like it does something is worse than no file.

**Rejected — computing unlock now** from `Order.created_at + (N−1) × pace delay`. The configured
delays are 7/3/1 days, so this would lock chapters 2+ immediately and break the product today.

> **Flagged for #8, not a seam question:** Home needs a per-chapter *state*, not a boolean. With
> cadence, a locked chapter should read "unlocks Tuesday", not silently vanish from the list.
> `can_read` is right for *gating* (`/read`, PDF bytes, chat) and wrong for *display*. Moot today
> because everything is unlocked — named now so it doesn't ambush #8.

---

## D26 — `onboarding.create_reader`: reuse, refuse, and a password nobody has

**Locked** 2026-08-25

```python
onboarding.create_reader(full_name, email, phone, book, pace) -> OnboardingResult
```

### Identity collisions: reuse on exact match, refuse on partial

`email` and `phone` are both unique (D19). **An existing reader buying a second book is a normal
event, not an error** — `Order` is unique per `(user, book)`, not per user. A function that
hard-fails there makes your most loyal customer the one you cannot onboard.

| Situation | Behaviour |
|---|---|
| Both fields match the same user | **reuse** — add the `Order`, mint the grant, send chapter 1 |
| Both match, and they already own this book | refuse — a double-charge or a slip |
| Email is user A, phone is user B | refuse — two accounts, no safe guess |
| One matches, the other is new | **refuse, loudly, naming the field** |

**The last row is the one that matters.** A changed phone number and a typo'd phone number are
*identical* to the code, and guessing wrong is expensive both ways: silently updating sends chapter
links to a stranger's phone; silently creating a second account loses the reader the book they paid
for. An admin can tell in two seconds; the code cannot.

Changing a phone number stays a deliberate admin edit, never a side effect of buying a book.

Survives Stripe unchanged: a webhook carrying email and phone hits the same four cases, and a
refusal becomes a support ticket rather than a corrupted account.

### Transaction boundary: three rows atomic, delivery outside

`User` + `Order` + first grant commit atomically. The WhatsApp send happens **after** the block, and
its `MessageLog` comes back in the result.

**Rolling back on a delivery failure is wrong**, and increasingly so once Stripe lands: the money is
taken, and discarding the reader because Twilio hiccuped turns a delivery problem into a refund
problem. D17 already says a Twilio failure never breaks the transaction.

**Why the caller is told:** a mistyped phone number is the single most likely failure in concierge
onboarding, and the person who can fix it is standing in Django admin at that moment. Silence means
the reader exists, believes nothing happened, and nobody notices until they complain.

**Rejected — `transaction.on_commit`.** Safer under nesting, but the send fires after we return, so
the caller cannot report the outcome.

**Rejected — no send here at all.** Breaks D12's guarantee that onboarding delivers chapter 1, and
makes the Stripe webhook responsible for remembering a second call.

> **Constraint this creates:** `create_reader` must never be called from inside an outer
> `atomic()` block — the grant would not be committed when Twilio is handed a link to it. Nothing
> does today (admin actions and management commands run unwrapped). Documented in the docstring
> rather than defended against in code.

### The password: unusable, plus a "set your password" link

A concierge-created reader has no password and needs one, because Home is session-gated (D7). They
can read chapter 1 without it — WhatsApp links self-authenticate — but their library is unreachable.

`create_reader` sets an unusable password and sends a link built on `PasswordResetToken`
(single-use, ~1 hour, D21).

**Rejected — generating a password and sending it over WhatsApp.** D21 makes reset links single-use
*precisely because WhatsApp history is permanent*; sending a reusable password down the same channel
contradicts that outright.

**Rejected — the admin sets one and passes it on.** Handling plaintext credentials by hand, per
reader, forever.

> **Acted on in #3, and on the critical path:** template #4's copy must be **neutral** — "Set a
> password for your Sapien Paradox account", not "Reset your password" — so one approved template
> serves both a new reader and a returning one. Otherwise this is a fifth template and another
> Meta review cycle of days to weeks.

---

## D27 — WhatsApp delivery: one mechanism, named wrappers

**Locked** 2026-08-25 · **refines D12**

```python
whatsapp.send_chapter(grant) -> MessageLog
whatsapp.send_password_reset(reset_token) -> MessageLog
whatsapp._deliver(template_key, user, to_phone, variables, grant=None) -> MessageLog
```

### It takes a grant, because minting is the caller's decision

The five callers need genuinely different minting behaviour:

| Caller | Needs |
|---|---|
| Home "send to my WhatsApp" | **reuse** a live grant — else a button press spawns a token each time |
| Sanctuary re-issue (D9) | **mint fresh** — the point is that the old token dies |
| `create_reader` | the first grant |
| Admin action · CLI | reuse or mint, admin's call |

If `send_chapter` minted internally it would need a `force_new` flag — and a boolean that changes
what a function fundamentally does means the decision belongs to the caller. `grants.mint_or_reuse`
and `grants.reissue` let each caller state its intent by choosing a function.

### D12 pointed at the mechanism, not the name

D12 said every message goes through `send_chapter(grant)`. D16 later routed **password reset** over
WhatsApp, and that has no grant and no chapter.

What must exist exactly once is the **mechanism**: the 3-attempt retry with its transient-only rule,
the `MessageLog` written `pending` before the attempt and updated in place, the Twilio/console
switch, and the rule that a rendered body is never stored because it holds a live token.
`_deliver` owns all of it.

**Rejected — a separate implementation for reset.** Duplicated retry policies drift: one gets the
"never retry 4xx" rule and the other doesn't, and you find out when a bad number retries for a year.

**Rejected — a single generic `send(template_key, user, variables)`.** Pushes variable assembly to
every caller, which is exactly where it drifts from `content/templates.py`. The wrapper is the right
place to know the chapter template's variables are *(reader name, chapter title, link)* in that
order.

### Returns a `MessageLog`. Delivery failures never raise

This makes D17's guarantee **structural rather than conventional**. D17 says a Twilio failure must
never break the transaction — with exceptions, that holds only while every one of five callers (and
a cron job to come) remembers to catch. One forgotten `try` and a failed send takes down onboarding,
the exact outcome D17 exists to prevent. A function that cannot raise cannot cause it.

Returning the row rather than a bool is what lets `create_reader` report delivery status (D26): the
row carries the attempt count, Twilio's error, and the id to re-send from.

**The one exception:** an unknown `template_key` or a missing template variable is a *programmer*
error. It raises loudly at development time rather than producing a `failed` row that looks like
Twilio's fault. **Delivery failures return; bugs raise.**
