# The machine layer

D36 · D37 · D38 · D39 · D40

Locked 2026-08-30, by grilling. The backend's flow — every branch, every guard, every legal path
between states — lives in declarative transition tables. **The three seams are untouched** and
remain the only path to an effect.

```
core/api/        HTTP only. Request → event, result → status code.
core/machines/   States, events, guards, transitions. Pure Python. THE FLOW.
core/services/   The seams. All I/O. THE EFFECTS.
core/models.py   Data.
```

---

## D36 — Machines are the orchestration layer

**Locked** 2026-08-30 · **amends the layering table in `apps/api/CLAUDE.md`**

Flow moves out of `services/` and into `machines/`. Services keep every signature, every
transaction boundary and every failure guarantee that D25–D27 established; they simply stop
deciding what happens next.

### What this changes

The layering table previously said `core/services/*` holds **all** business logic. That is no
longer true, and the sentence is replaced: services hold all **effects**; machines hold all
**flow**.

**D25, D26 and D27 are unchanged.** `access.can_read` still returns a plain bool.
`onboarding.create_reader` still commits three rows atomically and delivers outside the
transaction. `whatsapp.send_chapter` still returns a `MessageLog` and never raises. Machines decide
*when* a seam is called; nothing bypasses one.

### Why a fourth layer rather than tidier services

The split is between **deciding** and **doing**. Today a service does both, so reading what happens
next means reading how it is done. Separating them means the flow can be read on its own — which is
the entire point, given what went wrong in V1.

**Rejected — guarded status fields on models** (`django-fsm`-style, transitions as decorated model
methods). Lighter, and it would have fixed the duplicate-validity problem. Rejected because it is
not event-driven: callers invoke named methods, so the branch selection stays in the caller. The
transition table would describe what is *legal* without describing what *happens*.

**Rejected — a workflow engine** (Viewflow, Temporal). There is one process, it has six steps, and
the database already records where every grant is. A workflow engine is for when "where is this?"
cannot be answered by a query. It can.

**Cost accepted:** an indirection appears between endpoint and effect. Reading a login means
reading the endpoint, a table row, a guard and an action — four small files instead of one
function. Better for seeing the flow, worse for tracing a single call.

**Cost accepted:** two of the five machines are thin at today's scope. `auth` has two states;
`reading` only reaches four once cadence lands. This is more structure than today's flows need, and
it is deliberate — cadence and payments are exactly where V1 got into trouble.

> **Inherited from V1**
> - **V1 did:** flow and effects together in `core/services/`, with state implied by nullable
>   timestamps. Validity was implemented twice — `TemporalGrant.is_valid()` and
>   `grants.py::_classify()` — with different behaviour. A `max_views` quota reached the schema
>   without appearing in any plan document.
> - **V2 does:** flow in declarative tables; state is an explicit column.
> - **Why:** V1 did not fail on bad code, it failed on invisible logic. A transition table is the
>   smallest artefact that makes a flow visible: states are enumerated and every path is a row.
> - **Revisit if:** the tables start describing a single linear path with no branches, which would
>   mean the ceremony is not buying anything.
> - **Follow V1?** ☐ yes ☑ no

---

## D37 — `transitions`, and machines never import Django

**Locked** 2026-08-30

The library is [`transitions`](https://github.com/pytransitions/transitions). What actually
delivers the portability is the import rule, not the library:

**`core/machines/` imports nothing from Django.** Guards and actions receive their dependencies as
injected callables. The only Django-aware module in the layer is `machines/binding.py`.

### Why this library

`Machine(model=obj)` binds to **any plain object** — a Django model, a dataclass, a stub in a test.
Nothing about a machine assumes an ORM. It also renders a diagram from the transition definitions,
which is what keeps the picture from drifting from the code.

**Rejected — `django-fsm-2`.** Django-native, and would have given state persistence for free. It
is method-driven rather than event-driven, which is the model we are deliberately not using (D36),
and it would couple every machine to Django.

**Rejected — `python-statemachine`.** Pure Python and perfectly capable. Smaller ecosystem, and no
`model=` binding, so it couples slightly harder to whatever it is attached to.

**Rejected — hand-rolling it.** About sixty lines, and honestly tempting. Rejected for the diagram
generation, which is most of the value: a picture nobody has to maintain.

**Cost accepted:** persisting state to a column is glue we write once, in `binding.py`.

---

## D38 — Dispatch returns a result; refusals become status codes at the edge

**Locked** 2026-08-30

```python
TransitionResult(ok: bool, state: str, refusal: str | None, data: Any)
```

`dispatch(machine, subject, event, deps, **payload)` is the single entry point. The API layer owns
the mapping from refusal code to HTTP status; no layer below it knows what a 403 is.

### This delivers what D25 deferred

D25 wanted a result object carrying *why* access was refused — "you don't own this" and "this
unlocks Tuesday" need different screens — and rejected it rather than guess today what tomorrow's
reasons would be.

**Guards are where that reason naturally lives.** A guard exists per transition, so it already
knows which refusal it represents. `access.can_read` stays the plain bool D25 locked; the guard
that consults it emits the code. The upgrade arrives without touching the seam and without putting
HTTP in a service.

**Rejected — raising exceptions for refusals.** A service raising an error whose only purpose is to
become a 403 has put HTTP in the service layer, which D25 already ruled out for the same reason.

---

## D39 — Cadence is an event source, not a queue

**Locked** 2026-08-30 · **reads against D17**

A scheduled management command finds grants whose `unlock_at` has passed and sends each an
`UNLOCK` event. No broker, no worker service, no new infrastructure.

**This is within D17's intent, and is stated so it is not read as a violation.** D17 rejects a job
*queue*; this adds none. Every grant already carries its own `unlock_at`, so the schedule lives in
the table that owns it — a queue would be a second copy of a fact the database already holds.

The shape is also what makes catch-up free: a tick asks "what is due?", so an outage delays
chapters rather than losing them. There is no missed-run recovery to write.

**Rejected — cadence as a sixth machine.** It would need a state of its own to keep synchronised
with `unlock_at`. That is precisely the duplication this layer exists to remove.

---

## D40 — Outcome-branching, not exceptions

**Locked** 2026-08-30

Actions return outcomes. Guards branch on them. **A failed delivery is the absence of a
transition**, retried on the next tick.

`UNLOCK` therefore has two rows from `scheduled` on the same event: one guarded on delivery having
succeeded, which moves to `live`; one guarded on failure, which stays put. No rollback, no
exception, and no "have we already sent this?" flag.

### This works because D27 already made it possible

D27 locked that `whatsapp.send_chapter` returns a `MessageLog` and never raises, so that a Twilio
failure cannot break a transaction through a caller who forgot to catch. That same property is
exactly what a guard needs: something to read.

**The one exception is unchanged from D27** — an unknown template key or a missing variable is a
*programmer* error and raises loudly. **Delivery failures return; bugs raise.**

**Rejected — transaction rollback on a failed effect.** Discarding a reader because Twilio hiccuped
turns a delivery problem into a refund problem once payments land. D26 settled this already.

**Cost accepted:** delivery is at-least-once. A send that succeeds while the write fails will be
retried, so a reader could receive a duplicate. A duplicate message is mildly awkward; a silently
dropped chapter is the product failing at its one promise, invisibly.
