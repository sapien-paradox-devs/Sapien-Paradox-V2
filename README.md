# Sapien Paradox V2

A modular, cadence-paced learning platform for intellectual explorers. A reader buys a book; its
chapters unlock on a schedule; each arrives by WhatsApp as a self-authenticating link; they read it
in a token-gated chamber and discuss it with a companion.

## Layout

Monorepo, two independently deployable apps.

```
apps/api/     Django 6 + Django Ninja + Postgres    → api.<domain>
apps/web/     React + Vite + TypeScript + XState    → app.<domain>
shared/       constants both sides must agree on
decisions/    every locked decision, and why
```

## Running it

Neither app needs credentials. The API falls back to SQLite, local file storage, and a console
WhatsApp backend; the companion is simply unavailable without a key.

```bash
# api  →  :8000
cd apps/api
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python manage.py migrate
.venv/bin/python manage.py runserver

# web  →  :5173
cd apps/web
npm install
npm run dev
```

Check it: `curl localhost:8000/api/health`

## Where things are written down

| File | Holds |
|---|---|
| `CLAUDE.md` | how to work here — workflow, seams, mandates |
| `DESIGN.md` | what we're building and how it fits together |
| `decisions/` | every locked decision, with rejected alternatives |
| `STATUS.md` | what's deployed, the current milestone, what to revert |
| `apps/*/CLAUDE.md` | per-app architecture |
| GitHub milestones + issues | the plan (D49) |

**Decisions live in `decisions/` and nowhere else.** If the same decision appears in two places,
that's a bug.

## Working on it

Issue first, then a branch, then one PR. See `CLAUDE.md`.
