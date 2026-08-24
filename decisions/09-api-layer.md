# API layer

D29 · D30 · D31 · D32 · D33

**Locked** 2026-08-25. These are the five gates that stood in front of endpoint code (G1, G2, G4,
G5, G6 in `apps/api/BUILD.md`). Each had a recommendation that stood unchallenged across several
sessions; they are adopted here so code can start. All five are cheap to reverse — each touches one
file — and any of them may be revisited on evidence.

---

## D29 — The PDF endpoint is `GET /api/grants/{token}/pdf`

V1 served bytes from `/api/shards/stream/?token=`. D4 deleted the `Shard` table, so that name
points at a concept that no longer exists.

Grant-centric, and consistent with its siblings `GET /api/grants/{token}` and
`POST /api/grants/{token}/reissue`. The token in the path rather than the query string also keeps it
out of the places query strings leak into — referrer headers and server access logs — which matters
because the token is a credential (D22).

**Documentation bug this closes:** mandate 1 in `apps/api/CLAUDE.md` still cited the old path.
Fixed alongside this decision.

---

## D30 — CSRF is enforced on session endpoints and exempt on grant-authenticated ones

**Session endpoints enforce it.** D6 puts the SPA and the API on sibling subdomains, so session
POSTs need it: `CSRF_COOKIE_DOMAIN=.<domain>`, and the SPA sends `X-CSRFToken`.

**Grant-authenticated endpoints are exempt.** CSRF defends against *ambient* authority — a cookie
the browser attaches automatically to a request the user did not intend. **A grant token is not
ambient.** It is in the URL the reader deliberately opened, and it is not attached to anything else.
There is nothing for an attacker to ride.

Enforcing it there would break the product's main path entirely: a reader arriving from WhatsApp has
no cookies at all for our domain, so there is no CSRF cookie to present.

**Revisit if** an endpoint is ever made to accept either auth class — but D7 forbids exactly that,
so this holds as long as D7 does.

---

## D31 — Rate limits are counted from existing rows, not a counter

Four limits are specified: re-issue (one per grant per hour, D9), chapter send (one per chapter per
hour, D11), reset request (one per user per 15 minutes, D21), and the companion's daily caps (D7).

**They are enforced by counting rows already written** — `MessageLog` for the first two,
`PasswordResetToken` for the third, `ChatUsage` for the fourth — within the cooldown window. Window
lengths live in `settings.py`, read from env, so they can be tightened without a deploy.

**Why not a counter:** there is no Redis (D17), and adding one would mean a sixth external system, a
second thing that can be down, and a count that disagrees with the record. The tables already
contain the truth; a counter would be a cache of it that can drift.

**Accepted cost:** a `COUNT` per rate-limited request. These are low-frequency endpoints — sending a
message, re-issuing a link — and every one of them is already doing far more expensive work.

**Revisit if** a rate-limited endpoint ever becomes high-frequency. The companion's per-message cap
is the one most likely to get there.

---

## D32 — `GET /api/read/{chapter_id}` stays a GET, and is idempotent

It can mint a grant, which makes it look like it should be a POST.

**It reuses any live grant and mints only when none exists**, so repeating it does not accumulate
state. The frontend navigates to it directly; a POST would mean an interstitial page — a screen a
reader sees for no reason, on the path to reading.

**The honest objection:** a GET that can write is a GET that a link prefetcher or a crawler could
trigger. Two things make that survivable — the endpoint is session-authenticated, so no crawler
reaches it; and the write it performs is the same write the reader was about to cause anyway.

**Revisit if** grant rows ever become expensive, or if prefetching produces a measurable pile of
unused grants.

---

## D33 — The companion's caps live in `services/companion.py`

Not in the API layer.

`/api/chat` is the only endpoint that is token-authenticated **and** spends money per call (D7), so
its limits are load-bearing rather than defensive. Putting them in the service means every caller
inherits them — a management command, a future scheduled job, anything added later. Putting them at
the endpoint means each new caller has to remember, and the one that forgets is the one that runs in
a loop.

Consistent with the layering rule: the caps are business logic, not an HTTP concern. The endpoint
turns a refusal into a status code, as it does for every other refusal (D25).
