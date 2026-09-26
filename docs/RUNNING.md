# Running, building, and deploying

Two independently deployable apps in one repo. Everything below assumes you are at the repo root.

`README.md` has the 30-second version. This file is the depth.

---

## Requirements

| | |
|---|---|
| Python | 3.13 |
| Node | 22 |
| Postgres | **not needed locally** — the API falls back to SQLite |

**No credentials are required to run either app.** The database falls back to SQLite, file storage
to the local disk, WhatsApp to a console backend that prints instead of sending. The companion is
simply unavailable without an Anthropic key. This is mandate 6, and CI enforces it by running with
no secrets at all — if a fresh clone ever stops working, CI fails before you do.

---

## First-time setup

### API

```bash
cd apps/api
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python manage.py migrate
.venv/bin/python manage.py createsuperuser      # email, phone, full name
```

`createsuperuser` asks for a **phone number as well as an email** — `User` requires it, because
phone is both the delivery and the account-recovery channel (D16, D19).

Copy `.env.example` to `.env` only when you need to override a default. Nothing in it is required.

### Web

```bash
cd apps/web
npm install
```

---

## Daily commands

### API — from `apps/api`

```bash
.venv/bin/python manage.py runserver               # :8000
.venv/bin/python manage.py test core
.venv/bin/python manage.py makemigrations core
.venv/bin/python manage.py migrate

# What CI checks. Run it before you push — migration drift on main
# blocked several tickets in V1.
.venv/bin/python manage.py makemigrations --check --dry-run
.venv/bin/python manage.py check
```

Admin is at `localhost:8000/admin/`, the API docs at `localhost:8000/api/docs`.

Django admin is a **product surface**, not a debug tool — concierge onboarding is the entire way
readers come into existence (D10).

### Web — from `apps/web`

```bash
npm run dev          # :5173
npm run build        # tsc -b && vite build  →  dist/
npm run typecheck
npm run preview      # serve the built dist/
```

`npm run build` runs the type check first, so a type error fails the build. That is the same command
CI runs.

### Is it alive?

```bash
curl localhost:8000/api/health
# {"status":"ok","database":"ok"}
```

This endpoint deliberately touches nothing but the database. A health check that fails because
Twilio is slow is worse than no health check.

---

## Environment variables

`apps/api/.env.example` is the complete list, grouped and commented. What actually matters, and
when:

| Group | Local | Production |
|---|---|---|
| `DJANGO_SECRET_KEY` | ignored | **required** — startup refuses without it when `DEBUG` is off |
| `DATABASE_URL` | unset → SQLite | **required** — Render's managed Postgres URL |
| `AWS_*` | unset → local disk | **required** — R2 bucket, keys, endpoint |
| `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS` | defaults to `:5173` | the real SPA origin |
| `COOKIE_DOMAIN` | **leave empty** | `.<domain>` — makes the session cookie first-party |
| `APP_BASE_URL` | `:5173` | the SPA URL; WhatsApp links are built from it |
| `TWILIO_*` | unset → console | required to actually send |
| `ANTHROPIC_API_KEY` | unset → no companion | required for the companion |

**`COOKIE_DOMAIN` must stay empty locally.** The SPA and API differ only by port, which is the same
site, so no cookie domain is needed. Setting one breaks login locally in a way that looks like a
backend bug.

Grant TTL, rate-limit windows, cadence delays, and the companion's caps are all env-overridable so
they can be tightened, or sped up for a demo, without a deploy.

---

## CI

Two workflows, path-filtered so a frontend-only PR doesn't run the backend suite. `shared/` is in
both filters, because a change there can break either side.

| Workflow | Runs when | Does |
|---|---|---|
| `api` | `apps/api/**`, `shared/**` | `check` · `makemigrations --check` · `test core` |
| `web` | `apps/web/**`, `shared/**` | `npm ci` · `npm run build` (includes `tsc -b`) |

Neither job has credentials. That is deliberate.

---

## Deploying

Split origin under one parent domain (D6): `app.<domain>` for the SPA, `api.<domain>` for Django,
session cookie scoped to `.<domain>`. Unrelated vendor domains would make the session cookie a
third-party cookie, which Safari and most blockers drop — login would silently fail on some
devices and work fine on yours.

### Live as of 2026-09-17

| | |
|---|---|
| API | **https://sapien-api.onrender.com** — `srv-dam7kdh42hec738jl5tg` |
| Database | `sapien-db` — `dpg-dam55mvqj5pc73bskqng-a`, free, Singapore, **expires 2026-10-17** |
| Health | `{"status":"ok","database":"ok"}` |
| Tables | all eight present, migrations `0001` and `0002` applied |

**Start command, set on the live service 2026-09-23 through the Render API** (the dashboard does
not read `render.yaml`, see below): `python manage.py migrate --no-input && python manage.py
render_chapters && gunicorn config.wsgi:application --workers 2 --threads 4 --timeout 120`. Until
then production had no page images and every chapter showed "The pages did not load" (D73). **If
you change `startCommand` in `render.yaml`, change it on the service too.**

**The service was created through the Render REST API, not the Blueprint**, because neither the
API nor the MCP can apply a `render.yaml`. The payload was generated *from* `render.yaml` so the
file stays the source of truth — but the two can now drift, and nothing enforces agreement. Re-check
the file against the dashboard before trusting it.

**External Postgres access is closed** (`ipAllowList: []`, Render's default). Verifying the schema
means temporarily adding an IP, querying, and removing it again.

**Confirmed: the free instance spins down.** The log shows `Handling signal: term` roughly fifteen
minutes after the last real request. Render's own health checks do not keep it awake. This is
exactly what D23 forbids and D35 accepted for Phase 0.

### API and database — Render, from `render.yaml`

**Render → New → Blueprint → select this repository.** `render.yaml` at the repo root provisions
the web service *and* the Postgres instance, wires `DATABASE_URL` between them over the private
network, and generates `DJANGO_SECRET_KEY`. Render prompts for the values marked `sync: false`.

Both live in **Singapore**, Render's closest region to India. Change one and you must change the
other — a service and database in different regions lose the private network and fall back to a
slower, publicly-reachable connection.

**The API deploys and stays healthy before any of the optional secrets exist.** With no Twilio
credentials, delivery prints to the log instead of sending; with no Anthropic key, the companion is
simply unavailable. That is what makes it deployable *now*, before the WhatsApp templates clear
Meta review.

**Leave every `sync: false` field blank at Blueprint creation.** The service comes up healthy
without them; they are filled in afterwards.

`DJANGO_ALLOWED_HOSTS` used to be required immediately or the health check returned 400.
`settings.py` now appends Render's automatic `RENDER_EXTERNAL_HOSTNAME`, so the service's own
`onrender.com` address is always allowed and **the first deploy is green with no intervention**.
Set the variable only to *add* `api.<domain>` once DNS exists.

**Leave `COOKIE_DOMAIN` empty until the real domain is pointed.** Sessions spanning two subdomains
need it; on `*.onrender.com` there is no shared parent domain to scope a cookie to.

**Phase 0 runs on free tiers (D35), and that is time-boxed.** `render.yaml` specifies `plan: free`
for both the web service and Postgres. Two consequences with real deadlines:

- **Free Postgres expires 30 days after creation**, then has a 14-day grace period before deletion.
  There are no backups on this tier.
- **The free web service sleeps** after 15 minutes idle, ~1 minute cold start — the thing D23 says
  never to do. Tolerable only because no reader and no WhatsApp link exist yet.

Upgrade both plans before the first link reaches a real reader, or before the database expires —
whichever comes first. That reversal is a condition of D35.

Free instances also do not support `preDeployCommand`, which is why migrations run in the
**start command** instead. Move them back to `preDeployCommand` when the plan goes paid.

> **Never use a tier that sleeps.** Free tiers spin down and cold-start in roughly a minute, and the
> same applies to Postgres tiers that pause when idle. The core moment of this product is *tap a
> WhatsApp link → the chapter opens*. A reader staring at a blank screen for 50 seconds has had the
> product fail and will never know why. This is a product decision, not a cost one (D23).

> **The R2 bucket must be private.** `django-storages` can serve files publicly and many tutorials
> configure exactly that. If it happens here, every PDF gets a permanent public URL and the grant
> tokens, the 7-day expiry, and the whole proxy design are bypassed **at the infrastructure layer
> while the application code still looks correct** (D19). Nothing in this codebase generates a
> storage URL — the API only ever streams bytes.

### Chapter pages — after deploying D73

Readers never receive a PDF. Each page is rendered to a WebP image at upload and served
watermarked (D73). Chapters uploaded **before** D73 have no page images, and the reader cannot
open them until they do; they show "The pages did not load."

**On Render this is automatic:** `render.yaml`'s start command runs `render_chapters` after
`migrate`. If the service was created by hand rather than from the Blueprint, copy that start
command into the dashboard (Settings → Start Command). To run it yourself, anywhere:

```bash
.venv/bin/python manage.py render_chapters          # renders chapters with no pages yet
.venv/bin/python manage.py render_chapters --force  # re-renders everything
```

New uploads render from the admin save (the chapter screen and the book screen's chapter
inline), and `seed_dev` renders its own chapters.

### Uploads from the admin — R2 CORS, once (D85)

The book workspace (`/admin/books/:id`) sends files **straight from the browser to R2** on signed
URLs, so the bucket must accept a `PUT` from the app's origin and expose the `ETag` header (each part
of a large upload returns one, and completing needs them). In the Cloudflare dashboard → R2 → the
bucket → **Settings → CORS policy**:

```json
[
  {
    "AllowedOrigins": ["https://app.<domain>", "http://localhost:5173"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Until the domain exists, use the Vercel URL in `AllowedOrigins`. Without this rule, uploads fail in
the browser with a CORS error before any bytes move. **Without R2 configured at all** (a fresh
clone), uploads go through the API instead and need nothing.

Optional env: `PDF_MAX_MB` (100), `COVER_MAX_MB` (10), `UPLOAD_URL_TTL_SECONDS` (21600),
`UPLOAD_MULTIPART_THRESHOLD_MB` (50), `UPLOAD_PART_MB` (16).

**Preview the workspace without an account:** `npm run dev`, then
`http://localhost:5173/harness.html` (`?v=staged`, `board`, `videos`, `publish`). Sample data, no API.

### The cadence cron — Render, from `render.yaml` (D50)

**What it does.** `sapien-cadence` is a Render Cron Job that runs `python manage.py cadence_tick`
every fifteen minutes. Each run finds the `scheduled` grants whose `unlock_at` has passed, sends
each one `UNLOCK` through the reading machine, and so delivers that chapter over WhatsApp. It prints
one line — `due=… sent=… failed=… refused=…` — and **exits non-zero when any send failed**, so that
run shows red in the dashboard. A failed grant stays `scheduled` and the next run retries it; a
`refused` one (a deactivated reader, a row another tick held) is not an error.

**It does not need the web service awake.** The cron is its own short-lived instance built from
the same repo, talking to Postgres and Twilio directly. The free web service sleeping (D35) delays
no chapter; only the reader's tap on the link meets the cold start.

**Cost.** Cron jobs have no free tier. They are billed per second of run time on the smallest
instance; a tick that finds nothing due finishes in seconds, so at 96 runs a day this comes to
roughly **$1/month**. Its build is `pip install` only — no `collectstatic`, and no migrations,
which stay the web service's job.

**Environment.** Both services read the `sapien-shared` env group (secret key, `APP_BASE_URL`, R2,
Twilio); the cron wires its own `DATABASE_URL` from the database because a group cannot. Anything
cadence-related (`PACE_DELAY_DAYS_*`, `CADENCE_DELIVERY_HOUR`, `GRANT_TTL_DAYS`) goes **in the
group**, never on one service: the web service computes `unlock_at` at purchase and the cron
compares against it, so the two must agree.

**Moving the live web service onto the group — once, by hand.** `sapien-api` was created before
the group existed, so its variables are set on the service itself, and a service-level variable
overrides the group's. Syncing the Blueprint creates the group but leaves those in place. Until
they are removed, the two services can silently disagree.

1. Sync the Blueprint. It creates `sapien-shared` and `sapien-cadence` and prompts for the group's
   `sync: false` values.
2. Copy into the group the web service's current value for every key the group holds —
   **including `DJANGO_SECRET_KEY`**. The group generates a fresh key otherwise, and switching to
   it signs every reader out once.
3. Delete those same keys from `sapien-api` → Environment. `DATABASE_URL` and the web-only keys
   (CORS, cookies, Razorpay, Anthropic, `ONBOARDING_ALLOW_PHONE_REUSE`) stay on the service.
4. Redeploy `sapien-api` and check `/api/health`.

`WHATSAPP_BACKEND` and `WHATSAPP_MAX_ATTEMPTS` are not set anywhere and should stay that way: the
defaults (Twilio whenever `TWILIO_AUTH_TOKEN` is set, three attempts) are right for both services.

**Running a tick by hand** — from `apps/api` locally, or as `python manage.py cadence_tick` from
the cron's Shell tab to act on production right now:

```bash
.venv/bin/python manage.py cadence_tick --dry-run   # list what is due: grant, reader, book, chapter, unlock_at
.venv/bin/python manage.py cadence_tick             # send it
```

The dry run never prints a token or a link (D22); the grant's id is enough to find it in the admin.
Two ticks at once are safe — each row is locked while it is sent.

**Test deployment: watch a book flow in minutes.** Set, in the group:

| Variable | Value | Effect |
|---|---|---|
| `PACE_DELAY_DAYS_FAST` | `0.01` | ~14 minutes between chapters on the fast pace |
| `CADENCE_DELIVERY_HOUR` | *(empty)* | no 08:00 morning anchor; unlocks fall at exact offsets |

Buy a book at the fast pace and each fifteen-minute tick delivers the next chapter. The empty value
matters: *unset* means the 08:00 default, which would hold every chapter until the next morning.
The schedule is computed at purchase, so these affect only orders placed after they are set. Remove
both before a real reader buys.

### Web — Vercel (D34)

`apps/web/vercel.json` carries the framework, build, output, and the SPA rewrite. **Three settings
live only in the Vercel dashboard and cannot be set from that file:**

| Dashboard setting | Value |
|---|---|
| Root Directory | `apps/web` |
| **Include files outside of the Root Directory in the Build Step** | **ON** |
| Ignored Build Step | `git diff --quiet HEAD^ HEAD -- . ../../shared` |

**The middle one is not optional.** `src/lib/constants.ts` imports `@shared/constants.json`, which
`vite.config.ts` aliases to `../../shared` — outside this app's root (D20). With the toggle off,
Vercel uploads only `apps/web` and the build fails to resolve the import. This is exactly the
monorepo risk D20 flagged: *"confirm on the real hosts while there is nothing to lose."*
Duplication-with-a-matching-test is the recorded fallback if a host ever makes it impossible.

The **Ignored Build Step** mirrors the path filters the CI workflows already use, so an API-only
commit doesn't rebuild the SPA. Without it every backend push triggers a frontend deploy.

**The rewrite matters more than it looks.** `vercel.json` sends every unmatched path to
`index.html`. Without it, a reader tapping a WhatsApp link to `/r/:token` gets Vercel's 404 instead
of the reading room — the product's core moment, failing on a hosting default. Vercel checks the
filesystem before applying rewrites, so real assets in `dist/` still serve normally.

**The share card needs an absolute URL.** `index.html`'s `og:image` is filled at build time
(`appUrl` in `vite.config.ts`): `VITE_APP_URL` if set, else Vercel's built-in
`VERCEL_PROJECT_PRODUCTION_URL`, else relative. **Set `VITE_APP_URL=https://app.<domain>` once
the domain exists**, or previews keep pointing at the `*.vercel.app` address. WhatsApp caches a
preview per URL: when testing a new card, paste the link with a throwaway `?v=2`.

The icons and the card are exported from `apps/web/brand/` by `sh apps/web/brand/export.sh`
(headless Chrome + `sips`, macOS). Edit the source there, re-export, and commit both.

---

## Troubleshooting

**`AUTH_USER_MODEL refers to model 'core.User' that has not been installed`**
`settings.py` points at a custom user model that doesn't exist yet, usually because `core/models.py`
is missing or `core` isn't in `INSTALLED_APPS`. Django can't start at all in this state — not even
`manage.py check`.

**`Conversion of type 'string[]' to type 'readonly [...]' may be a mistake`**
TypeScript widens JSON imports, so values from `shared/constants.json` arrive as `string[]`, not a
literal union. The union is declared in `src/lib/constants.ts` and re-checked against the JSON at
module load — if you add a pace key, update both, and the assertion will tell you at boot if you
forget.

**`ImproperlyConfigured: Requested settings, but settings are not configured`**
Something imported Django (or `ninja`) outside a `manage.py` command. Use `manage.py shell`, or set
`DJANGO_SETTINGS_MODULE=config.settings`.

**Login works locally but not in production**
Almost always the session cookie. Check `COOKIE_DOMAIN` is `.<domain>` with the leading dot, that
both origins are in `CSRF_TRUSTED_ORIGINS`, and that the SPA sends credentials. V1 never hit this
because both sides ran on `localhost`.

**A WhatsApp link 404s**
`shared/constants.json` route patterns and the frontend router have drifted, or `APP_BASE_URL` is
wrong. The backend builds those links from the same file the frontend routes with, precisely so
this can't happen — if it did, one of the two stopped reading it.

---

## Not yet true

Honest gaps, so this file doesn't describe a system that doesn't exist:

- **The SPA has no API client**, so no `VITE_API_BASE_URL` yet. It arrives with the login slice.
- **Neither app has been deployed.** The build and start commands above have been run locally —
  `gunicorn config.wsgi:application` serves `/api/health`, and `collectstatic` post-processes
  cleanly through WhiteNoise — but the Render and Pages *settings* are what the decisions call
  for, not something verified against a live dashboard.

## Seeing the machines

The backend's flow lives in transition tables (D36). Render them as Mermaid:

```bash
python3 manage.py machine_diagram          # writes machine-diagrams/*.mmd
python3 manage.py machine_diagram --show   # prints them instead
```

Generated from the tables themselves, so a diagram cannot drift from the code.
Output is gitignored — regenerate it, never commit it. Paste a block into a pull
request and GitHub renders it inline, which is the cheapest way to show what a
rule change did.
