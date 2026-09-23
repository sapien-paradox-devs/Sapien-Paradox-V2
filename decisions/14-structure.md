# Structure — the app-per-domain rebuild

D59 · D60 · D61 · D62 · D63 · D64 · D65 · D66 · D67 · D68 · D69

Locked 2026-09-23, after reading ten production codebases (django-oscar, Salesman, Viewflow,
django-fsm-2, Mayan EDMS, pretix, Zulip, Sentry, Solidus, Airflow). The evidence is recorded in
`docs/PLAN.md` §4; the decisions are here.

**What forced this.** D36 made machines the orchestration layer. A year of building later, three of
the four machines have no production caller and D26's four identity cases exist in three places with
three different refusal vocabularies. The layer meant to prevent duplicated logic had become a third
copy of it.

---

## D59 — One Django app per domain

**Locked** 2026-09-23 · **reverses "One Django app, not several" in `apps/api/CLAUDE.md`**

```
apps/api/apps/
├── common/          BaseMachine · exceptions · phone · links
├── identity/        User · PasswordResetToken
├── catalog/         Book · Chapter
├── acquisition/     Order          + state_machine/
├── reading/         TemporalGrant  + state_machine/
├── delivery/        MessageLog     + state_machine/
├── companionship/   ChatUsage
└── cadence/         (no models)
```

Each app: `models.py · services.py · selectors.py · admin.py · api/ · tests/`, plus
`state_machine/` and `notifications.py` where they apply.

**The machine lives in a four-file package**, per app that has one:

```
state_machine/
├── __init__.py       public: <X>Machine, STATES, TRANSITIONS
├── definitions.py    STATES · TRANSITIONS · EVENT_INPUTS   — DATA ONLY
├── guards.py         <X>Guards — every condition
├── actions.py        <X>Actions — every before/after callback
└── machines.py       <X>Machine(BaseMachine)
```

`definitions.py` holding nothing but data is the point: **the flow can be read without reading how
any of it is done.** Guards and actions are classes rather than loose functions so a machine's
dependencies are constructor arguments rather than module-level imports.

### Why per-app rather than one app with layer folders

The previous proposal was to keep one app and add the missing layers. It was argued from Zulip and
Sentry, which are both far larger than this project and both layer-first. That argument was about
*file placement*; this decision is about *ownership*. Eight tables across six capabilities, each with
its own machine, services, reads and endpoints, is enough that "everything about buying a book" being
one directory is worth more than "everything that writes to the database" being one directory.

django-oscar — the closest production analogue in shape — is app-per-domain
(`apps/order/`, `apps/basket/`, `apps/catalogue/`), with layer-named files inside each.

**Cost accepted: cross-app FK dependencies and migration ordering.** `Order → Book`,
`TemporalGrant → Chapter + User`, `MessageLog → User + TemporalGrant`. This is real and it is the
thing that will bite. `identity` and `catalog` must land before anything that references them.

**Cost accepted: `AUTH_USER_MODEL` changes app label.** See D65.

**Rejected — one app, layer folders** (`api/`, `machines/`, `services/`, `selectors/`). Fewer moving
parts and no migration risk at all. Rejected because tracing one capability still means four
directories, and because the enforcement problem (D61) is solved the same way either way.

**Rejected — one file per machine.** Proposed on the evidence that our machines are 110–167 lines and
the three-file split was copied from the frontend's XState convention, which has no authority here.
Superseded: `definitions.py` being data-only is worth more than the file count, because it is what
lets the flow be read on its own.

> **Inherited from V1**
> - **V1 did:** two repos split by lane, one Django app, flow and effects together in `core/services/`.
> - **V2 does:** one repo, one app per domain, flow in `state_machine/`, effects in `services.py`.
> - **Why:** V1 did not fail on bad code, it failed on invisible logic. A capability you cannot point
>   at in the tree is one nobody can review as a whole.
> - **Revisit if:** cross-app migration ordering costs more than the legibility buys — the honest
>   trigger is a PR that has to touch three apps' migrations to change one field.
> - **Follow V1?** ☐ yes ☑ no

---

## D60 — `flows.py` is the root map, and a test keeps it true

**Locked** 2026-09-23

`config/flows.py` names every flow: its sentence, its subject, its machine, its entry points, the
seams it may touch, the tables it writes. Six rows. `manage.py map` renders it.

The name is Viewflow's convention for exactly this file, not an invention.

**One test makes it load-bearing:** every registered route appears in exactly one `Flow.entrypoints`;
every machine is referenced by exactly one flow; every name in `Flow.seams` is importable. **An
endpoint added without a home fails CI.**

**Rejected — auto-discovery** (python-statemachine imports `statemachines.py` from every installed
app). Viewflow registers explicitly, and an unregistered flow simply has no URLs. Explicit
registration plus a test gets the same property without magic.

**Rejected — a diagram.** A picture nobody has to update is a picture nobody does update. V1 died of
documentation that drifted from the code; this is the same failure with better typography.

---

## D61 — Layering is enforced by test and lint, not by review

**Locked** 2026-09-23

| Layer | May import | May not |
|---|---|---|
| `api/` | schemas, services, selectors, state_machine, exceptions | models, ORM |
| `state_machine/` | own package, exceptions | **Django**, models, services |
| `services.py` | models, selectors, content, exceptions | api, state_machine, `request` |
| `selectors.py` | models | services, api, state_machine |

`common/state_machine/binding.py` is the single sanctioned exception — the only Django-aware module
in the flow layer.

`tests/test_layering.py` walks the AST and asserts all four. `ruff` runs in CI; there is no linter in
this repository today.

**Violations that exist the day this lands go in a baseline file that can only shrink.** A new
violation fails immediately; the old ones are on a countdown.

**Why mechanical.** Zulip runs at roughly ten times this size on a layer-first tree, and what makes
it hold is one *stated and enforced* policy about what may live in `zerver/actions/`. This project has
had four such rules in two `CLAUDE.md` files, none enforced, and all four are currently violated.

---

## (withdrawn) — Cadence

Cadence is **D60**, locked on `110-planning-surface` (PR #111), with issues #112–#114 already open.
Nothing here restates it.

One addition is proposed as a comment on **#112** rather than as a decision: django-oscar expresses
"what a status change implies" as a *separate declarative cascade map* rather than as code. Applied
here, the tick owns **when**, the transition table owns **whether**, and a cascade map owns **what
else** — three questions, three artefacts, none of them an `if`.

---

## D62 — Retire the `auth` machine

**Locked** 2026-09-23

Two states, linear, no guards, no production caller. D36 accepted "two of the five machines are thin
at today's scope" as a cost and wrote its own revisit clause: *"the tables start describing a single
linear path with no branches."* That condition is met exactly.

`identity` has no `state_machine/`. Deleting one machine of four is D36 being applied, not abandoned.

---

## D63 — Every state change leaves a row

**Locked** 2026-09-23 · *(D54 is taken by the surface track — `13-surface.md`, unmerged on
`115-motion-foundation`. Numbering skips it so the two tracks can merge in either order.)*

`GrantStateChange(grant, from_state, to_state, event, refusal, at)`, written by
`binding.save_state`.

`MessageLog` records what we *sent*. Nothing records what a grant *did*. So "I never got chapter 3"
can be answered for the message and not for the grant, which is the half that matters when the
message was never attempted.

django-oscar writes exactly this row on every `set_status()`. It is cheap now and impossible to
backfill later.

**Rejected — django-simple-history.** Versions every column on every model; we want one narrow fact
about one model.

---

## D64 — `Order.state` is derived from its grants, never stored

**Locked** 2026-09-23

A reader's journey through a book has states worth naming — `onboarding`, `reading`, `stalled`,
`complete` — and they are **computed from the child grants**, never written to a column.

```
Order  (parent — derived)
 ├── grant ch.1  opened
 ├── grant ch.2  opened
 ├── grant ch.3  live        ← the reader is here
 └── grant ch.4  scheduled
```

This is Airflow's shape: `DagRun.update_state` aggregates its `TaskInstance` states. An `Order` is a
DagRun; a `TemporalGrant` is a TaskInstance.

**Derived, not stored**, for the reason expiry is derived: a stored parent state needs a sweeper to
keep it true, and then two places hold the same fact and eventually disagree. That is precisely V1's
`is_valid()`/`_classify()` failure.

**The machine's subject is never the entity it produces.** The acquisition machine runs over a
*transient purchase attempt*, not over the `Order` row it creates. Solidus tied its order state
machine to its checkout-flow states; issue #142 has been open since 2015 asking for them to be
separated. Ten years is a clear enough price.

**Revisit if** a query needs the parent state often enough to hurt — then it becomes a cached column
with the derivation as its only writer, never a second source of truth.

---

## D65 — Reset the migration files; keep the database

**Locked** 2026-09-23

Every model moves app label. Rather than `SeparateDatabaseAndState` surgery per model:

1. every moved model pins `class Meta: db_table = "core_<model>"`
2. migration files are deleted; each app generates a fresh `0001`
3. `migrate --fake-initial` marks them applied without running them, because the tables exist

**No data is moved, dropped, or rewritten.** Clean per-app history, one command.

**Why not simply drop the database.** The data is real — a completed Razorpay payment, a WhatsApp
message delivered to a handset, PDFs in R2 — and D5 makes the deployed instance the thing that must
keep working. The stronger reason: **if this migration cannot be done with data, none ever can.**
Learning the technique now, when nothing is at stake, is the cheapest it will ever be.

**The trap.** `--fake-initial` checks that a table *exists*, not that it *matches*. Schema drift would
pass silently here and surface at the next `ALTER`. So: rehearse against a restored production dump,
then `makemigrations --check`, and only then ship.

**Cost accepted:** table names stay `core_*`. Cosmetic. Renaming is a later, deliberate
`AlterModelTable` pass with a short window, not part of the rebuild.

---

## D66 — Split settings, split requirements, run pytest

**Locked** 2026-09-23

- `config/settings/{base,dev,prod}.py` — production posture readable on its own, rather than decided
  by `if DEBUG` at import time
- `requirements/{base,dev}.txt` — `pytest`, `ruff` and factories do not ship to production
- `pytest` + `pytest-django` + `pytest.ini`, with fixtures in `conftest.py`

Existing `TestCase` classes run unchanged under pytest, so the 246 tests migrate by collection rather
than by rewrite. **No test assertion changes during the rebuild** — that rule is what makes "no
functional change" checkable instead of hopeful.

**Rejected — keeping the Django test runner.** It works. pytest is chosen for fixtures, which is what
makes per-app `conftest.py` worth having across eight apps.

---

## D67 — The clean foundation lands before the first real reader

**Locked** 2026-09-23 · **amended by D72** (`15-reading.md`): the landing page, the chamber and
reading progress proceed on the current structure rather than waiting for the rebuild. The rebuild
still precedes cadence, which is what D67 was protecting — cadence is the feature that touches the
three places the identity logic was duplicated.

The rebuild (D59–D66) completes before cadence, before the surface track's remaining work, and
before anyone who is not the owner uses the product.

**Why.** Cadence touches checkout, grants and delivery — the exact three places where D26's identity
logic is currently written three times. Building the product's headline feature through that would
make the known mess worse in the highest-traffic path, and would have to be unpicked afterwards.

**Rejected — first real reader first.** Ship cadence and the surface on the current structure, prove
the product with one person, restructure later. It is the option with the shorter path to evidence,
and it was rejected because the evidence it buys is about the product, while the cost it incurs is
in the code — and the code is what the next six features are written against.

**Track A is not part of this trade and starts immediately.** Domain, WhatsApp sender application,
the four Meta templates, Razorpay KYC. All are weeks of someone else's review queue, cost zero
engineering hours, and only begin when they are begun. A foundation that finishes into a blocked
demo has chosen badly for no gain.

**Revisit if** the rebuild has not finished when Meta's approvals land. At that point a working demo
is available and unbuilt, and the trade changes.

---

## D68 — Models move in one PR; everything else moves app by app

**Locked** 2026-09-23

```
PR A   models only     8 models into 6 apps · db_table pinned · imports updated
                       core/models.py deleted · migrate --fake-initial
                       NO logic changes, NO test assertion changes
PR B…  per app         services · selectors · api · state_machine, one app per PR
PR n   core/ deleted
```

**Why one PR for the models.** `AUTH_USER_MODEL` is a single setting naming a single model, so
`core.User` and `apps.identity.User` cannot coexist: the moment the setting flips, every `core` model
is FK'd across an app boundary and two models claim `core_user`. The models therefore move together
or not at all. Issues #6–#11 as originally drafted assumed a strangler and were wrong about this.

**What makes it safe.** PR A changes no logic. Every model keeps its fields, its `Meta`, and its
table name (D65). Every import is updated mechanically. The 246 tests must pass **with no assertion
changed** — only import paths. A diff that large is reviewable precisely because nothing in it is a
decision.

**Rejected — one big-bang rebuild PR.** Honest about being one change, and a single revert undoes it.
Rejected because ~120 files with logic changes mixed in has nothing to bisect when the deploy fails,
and because the review would be theatre.

**Rejected — new tables plus a data migration.** Clean table names and the safest rollback. Rejected
because it adds a hand-written copy of eight tables that has to be exactly right, to buy a cosmetic
improvement D65 already deferred.

**Revisit if** PR A cannot be made to pass with unchanged test assertions. That would mean a model
is carrying behaviour that belongs in a service, and that service should move first.

---

## D69 — Fix the logic in `core/`, then move it

**Locked** 2026-09-23

Three logic changes land on the **current** structure, before any file moves:

1. wire the acquisition machine — D26's four identity cases stop existing three times
2. wire the delivery machine over `whatsapp._deliver`
3. delete `core/machines/auth/` (D62)

Only then do D68's move PRs begin.

**Why.** You do not carefully re-home 142 lines of machine you are about to delete, or move three
copies of a rule in order to collapse them next week. Moving less is the smaller reason; the larger
one is that a **logic change is easiest to review against paths the reviewer already knows.** A diff
that both relocates a file and changes what it does is a diff nobody can read, and it destroys the
one property that makes this whole rebuild checkable: *if a test assertion changed, something is
wrong.*

**Rejected — move first, fix after.** Keeps every move PR perfectly mechanical, which is genuinely
attractive. Rejected because it spends that mechanical purity on relocating code already slated for
deletion.

**Rejected — fix as part of each app's move.** Fewest PRs. Rejected for the reason D68 exists: when
a test fails you cannot tell whether the move or the fix broke it.

### The consequence, stated so it is not discovered later

D59's `state_machine/` package uses `<X>Guards` and `<X>Actions` **classes**; `core/machines/` uses
module-level functions. So a machine's move is not mechanical unless the shape already matches.

**Therefore the fix in step 1–2 writes guards and actions as classes from the start**, against the
existing `core/machines/` dispatch. The later move is then genuinely a file move: the class comes
across unchanged and `definitions.py` receives the table it already has.

**Revisit if** writing classes against the old dispatch proves awkward enough to distort the fix. In
that case the machine move is accepted as a rewrite covered by its existing tests, and it moves last.
