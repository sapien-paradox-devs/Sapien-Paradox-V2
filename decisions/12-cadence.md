# Cadence

D50, D89

D50 was locked on `110-planning-surface` (PR #111) and copied to `main` on 2026-09-26 so the
cadence issues (#112–#114) build against a decision the index can see.

---

## D50 — The schedule is minted at purchase; a Render Cron Job ticks it

**Locked** 2026-09-22 · *applies D39 and D40; refines D8*

**The paces:** `slow` = one chapter every **7 days**, `medium` = every **3 days**, `fast` = every
**day**. Chapter 1 is delivered at purchase, as today. Chapter *n* unlocks at **08:00 IST** on
purchase-day + (n−1) × interval — a fixed morning hour, so a 2 a.m. purchase does not deliver
chapter 2 at 2 a.m. three days later. Both numbers live in `settings.py` and are env-overridable,
so a test deployment can shrink an interval to minutes and watch a whole book flow in an afternoon.
The interval is the existing `PACE_DELAY_DAYS` (per pace, a float, so `0.01` is about fifteen
minutes); the hour is `CADENCE_DELIVERY_HOUR`, and an empty value drops the morning anchor so
unlocks fall at exact offsets from the purchase.

**The schedule is rows, minted at purchase.** `onboarding.create_reader` mints chapters 2…N as
`scheduled` grants with `unlock_at` set, inside its transaction — they are rows, not sends. The
table is the schedule (D39): Home reads `unlock_at` to say "unlocks Thursday", and there is no
second copy to keep in sync.

**Expiry counts from delivery, not from minting.** `expires_at` defaults to seven days after
creation, so a chapter-5 grant minted at purchase would be dead before it unlocked. On a successful
`UNLOCK`, `deliver_chapter` stamps `expires_at = now + 7 days`. This is what D8 meant — a link
stays live roughly until the next chapter arrives — and it is robust to a tick that runs late.

**The trigger is a Render Cron Job**, `*/15 * * * *`, running `manage.py cadence_tick`. It is a
second service in `render.yaml` on the same repo, sharing an environment group with the API. It
does not sleep and does not need the web service awake — it talks to Postgres directly — so D35's
free-tier sleep does not touch it. Billed for run time; roughly a dollar a month.

**The tick is safe to overlap.** `cadence.tick` selects due rows with
`select_for_update(skip_locked=True)`. Render already serialises runs of one cron job; this makes
a second trigger (a manual run, a future second job) unable to double-send.

**`access.can_read` learns about `scheduled`.** D25 reserved this spot: ownership *and* unlocked.
`GET /api/read/{id}` on a scheduled chapter refuses with its own code, distinguishable from expiry
and from not-owned, because each needs a different screen.

**Rejected:**
- *GitHub Actions cron hitting a `POST /api/cadence/tick` endpoint* — free, but a throwaway
  endpoint with a shared secret, up to 30 minutes late, and deleted the day D35 ends. A dollar a
  month is cheaper than a shim.
- *An in-process scheduler thread* — dies every time the free instance sleeps; D17 territory.
- *Minting each grant at unlock time instead of at purchase* — Home could not show a date without
  computing it separately, which is the duplication D39 exists to prevent.
- *Extending `expires_at` from `unlock_at` at mint time* — breaks when the tick is late; the
  reader would get fewer than seven days.

**Revisit if:** readers ask to change pace mid-book (re-scheduling the remaining rows is a
service function, not a redesign), or if delivery hour should follow the reader's time zone.

---

## D89 — Cadence proceeds on the current structure *(amends structure-D67)*

**Locked** 2026-09-26 · owner's call

Structure-D67 (`14-structure.md`) says the rebuild (D59–D66, #131–#147) lands before cadence, and
D72 kept that ordering when it let the landing, the chamber and reading progress go first. **The
owner chose to build cadence now, on `core/`**, rather than wait for a rebuild that has not started.

**Consequences, stated so the rebuild can absorb them:**

- `services/cadence.py` is born in `core/`. It belongs in `apps/cadence` (no models, per the D59
  layout) and moves with Rebuild 13/14 (#140, #141) alongside the reading machine it dispatches to.
- `onboarding.create_reader` gains one call, `cadence.schedule(order)`. D67's worry — building the
  headline feature through identity logic written three times — is contained: scheduling reads the
  `Order` that identity resolution already produced and touches none of that logic.
- `manage.py cadence_tick` and the Render Cron Job (#113) are structure-neutral; the command moves
  with the service.

**Rejected:** *rebuild first, as D67 says.* It keeps D67 whole, but it holds the product's first
sentence behind twenty structural PRs, while the Meta template approvals (Track A) that gate a real
demo run on their own clock regardless.

**Revisit if** cadence ends up needing to change the identity path in checkout. At that point D67's
reason applies in full, and that change waits for Rebuild 12 (#139).
