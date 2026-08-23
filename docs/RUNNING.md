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

### API — Render

| Setting | Value |
|---|---|
| Root directory | `apps/api` |
| Build | `pip install -r requirements.txt && python manage.py collectstatic --no-input` |
| Start | `gunicorn config.wsgi:application` |
| Pre-deploy | `python manage.py migrate` |
| Health check path | `/api/health` |

Plus a managed Postgres instance, with its internal `DATABASE_URL` wired into the web service.

> **Never use a tier that sleeps.** Free tiers spin down and cold-start in roughly a minute, and the
> same applies to Postgres tiers that pause when idle. The core moment of this product is *tap a
> WhatsApp link → the chapter opens*. A reader staring at a blank screen for 50 seconds has had the
> product fail and will never know why. This is a product decision, not a cost one (D23).

> **The R2 bucket must be private.** `django-storages` can serve files publicly and many tutorials
> configure exactly that. If it happens here, every PDF gets a permanent public URL and the grant
> tokens, the 7-day expiry, and the whole proxy design are bypassed **at the infrastructure layer
> while the application code still looks correct** (D19). Nothing in this codebase generates a
> storage URL — the API only ever streams bytes.

### Web — Cloudflare Pages

| Setting | Value |
|---|---|
| Root directory | `apps/web` |
| Build | `npm run build` |
| Output | `dist` |
| Node | 22 |

Pages clones the whole repo, so `../../shared/constants.json` resolves. **Confirm that on the first
real deploy** — a host that isolates the subdirectory would break the import, and D20 names
duplication-with-a-matching-test as the fallback if so.

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
