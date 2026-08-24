# Decisions

Every locked decision, with its reasoning, its rejected alternatives, and what would make us
revisit it. **This folder is the record. `DESIGN.md` is the narrative and points here.**

If a decision is not written here, it is not decided.

## Conventions

- **D-numbers are permanent.** They are referenced from `DESIGN.md`, both `CLAUDE.md` files, and
  code comments. Never renumber. A superseded decision keeps its number and gains a
  `Superseded by` line — it is never deleted, because the reasoning stays useful.
- **Every departure from V1 carries an `Inherited from V1` block**: what V1 did, what V2 does,
  why, what would make us revisit, and whether we are still following V1.
- **Rejected alternatives are recorded**, not just the winner. The rejected option is what someone
  will propose again in six months.
- **Decisions land immediately**, before the turn ends. Sessions end abruptly.

## Index

**Start with [00-why-v2.md](00-why-v2.md)** — the audit of V1 that every decision below traces
back to. Without it these read as taste rather than as answers to specific, observed failures.

| # | Decision | File | Status |
|---|---|---|---|
| D1 | V2 is the same product as V1, rebuilt for control | [product](01-product.md) | locked |
| D2 | Deep specs for active work, a shallow spine for the rest | [process](02-process.md) | locked |
| D3 | Same engineering conventions as V1 (+ two XState departures) | [process](02-process.md) | locked |
| D4 | Domain model: four departures from V1 | [data](04-data.md) | locked |
| D5 | Deploy-first with real external dependencies | [infrastructure](03-infrastructure.md) | locked |
| D6 | Split origin under one parent domain | [infrastructure](03-infrastructure.md) | locked |
| D7 | Auth surface map; chat is token-gated with caps | [api-and-access](06-api-and-access.md) | locked |
| D8 | Grants expire after 7 days | [product](01-product.md) | locked |
| D9 | Expired links recover in one tap | [product](01-product.md) | locked |
| D10 | Readers are created by concierge onboarding | [product](01-product.md) | locked |
| D11 | Home links are session-gated and mint on demand | [api-and-access](06-api-and-access.md) | locked |
| D12 | Message templates in their own config file | [api-and-access](06-api-and-access.md) | locked |
| D13 | The chatbot is a chapter-scoped companion | [product](01-product.md) | locked |
| D14 | The companion never interrupts | [product](01-product.md) | locked |
| D15 | Frontend levels; root machine is two parallel regions | [frontend](05-frontend.md) | locked |
| D16 | Five external systems. No email provider | [infrastructure](03-infrastructure.md) | locked |
| D17 | No job queue. Bounded retry inside the request | [infrastructure](03-infrastructure.md) | locked |
| D18 | Eight tables | [data](04-data.md) | locked |
| D19 | Table specs: User, Book, Chapter, Order | [data](04-data.md) | locked |
| D20 | Shared constants in one file, read by both sides | [infrastructure](03-infrastructure.md) | locked |
| D21 | Table specs: TemporalGrant, MessageLog, ChatUsage, PasswordResetToken | [data](04-data.md) | locked |
| D22 | Logging: stdout only, and never log a token | [infrastructure](03-infrastructure.md) | locked |
| D23 | Platform: modular monolith, Django confirmed, two infra vendors | [infrastructure](03-infrastructure.md) | locked |
| D24 | Companion cost model (caching, 1h TTL) and vendor neutrality | [product](01-product.md) | locked |
| D25 | `access.can_read` — two questions, not one; returns bool | [seams](07-seams.md) | locked |
| D26 | `create_reader` — reuse/refuse, transaction boundary, the password | [seams](07-seams.md) | locked |
| D27 | WhatsApp delivery — one mechanism, named wrappers *(refines D12)* | [seams](07-seams.md) | locked |

## Still open

**See `STATUS.md`.** Open questions are not decisions, and listing them here too would drift —
which is the failure this folder exists to prevent.

Two of them contradict decisions already locked here, so they are worth knowing about while
reading: **#9** (a publicly-openable `/`) amends D7/D11, and **#10** (a signup page) reverses D10.
