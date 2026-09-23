# CLAUDE.md — apps/web

React + Vite + TypeScript, XState v5, vanilla CSS. Motion is browser-native: CSS + View
Transitions, started from `lib/motion.ts` (D54). No animation library. Serves `app.<domain>`.

Root context: `../../CLAUDE.md`. Design and decisions: `../../DESIGN.md`.

## Routes

| Route | Auth | Notes |
|---|---|---|
| `/login` | public | email + password |
| `/` | session | Home — account block + chapters |
| `/read/:chapterId` | session | mints-or-reuses a grant, then redirects (D11) |
| `/r/:token` | **token only** | the chamber. **No session required** — this is what makes WhatsApp links work |

Full surface map: `DESIGN.md` D7.

## Mandates

1. **Zero hardcoded strings.** Every piece of UI text goes through `src/lib/labels.ts` and is read
   via `locale.ts`. No exceptions — V1's login PR was blocked in review for a single hardcoded
   `"Welcome back,"`.
2. **Machine-first logic.** Complex UI state is an XState machine with the 5-file split:
   `machine.ts`, `actions.ts`, `guards.ts`, `actors.ts`, `index.ts`. Not scattered `useState`.
3. **No `as any`.** V1's first frontend PR was blocked for `as any` casts across eight files and
   for weakening `locale()`'s return type to `any`. The API is typed on the backend; keep it typed
   here.
4. **Variable Velocity.** Animations start fast, settle slow. Use the `--dur-*` tokens and
   `--ease-settle`; animate only `transform` and `opacity`; nothing moves while reading (D54).

## XState conventions

Derived from V1's `create-machine` skill, with three fixes for gaps found in V1's actual code.

### Location — one, no exceptions

```
src/pages/<page>/machine/
```

*V1 ran two competing conventions simultaneously (`src/machines/login/` and
`src/pages/reading-room/machine/`). One location.*

### Six files

| File | Contains |
|---|---|
| `types.ts` | `Context` and the `Event` union. **New in V2** — see below |
| `machine.ts` | `createMachine` only. Purely declarative: string references for actions, actors, guards. No implementations |
| `actions.ts` | individual `const`s using `assign`, collected into one exported `actions` object |
| `actors.ts` | `fromPromise` actors calling `mappedFetcher`, collected into one exported `actors` object |
| `guards.ts` | individual **named exports**, no wrapper object (imported via `import * as guards`) |
| `index.ts` | `setup({ types, actions, actors, guards }).createMachine(config)` |

### `setup()`, not `machine.provide()`

The split above is unchanged — `machine.ts` stays declarative and `index.ts` composes — but
composition uses `setup()`.

`provide()` does not typecheck when the implementations live in sibling files. `assign()` called
outside the machine widens its event to `EventObject`, and `provide` wants the machine's own event
union, so every context updater is rejected. `setup()` supplies the types at composition time and
everything infers.

One consequence: **`assign` is applied in `index.ts`, not in `actions.ts`.** Actions export plain
functions returning the context patch, and `index.ts` wraps them:

```ts
// actions.ts — a plain function, no assign
export function userFrom({ event }: { event: Event }): Pick<Context, "user"> {
  return { user: event.type === "AUTHENTICATED" ? event.user : null };
}

// index.ts
actions: { assignUser: assign(actions.userFrom) }
```

Side-effecting actions stay plain functions in `actions.ts` and are passed straight through.

**An actor's result arrives as `event.output`, not as one of your events.** A single updater shared
between `onDone` and a hand-sent event silently leaves context null on the actor path — which looks
exactly like being logged out. Give the actor path its own updater.

Omit `actors.ts` only when a machine genuinely has no async work. **Never add a seventh file** —
V1's landing machine grew `fields.ts` and `services.ts`, which is the signal a machine is doing
too much. Split it instead.

### `types.ts` — why V2 adds it

V1's convention said "define context as a plain object literal, no type annotations." That makes
every event access untyped, which forces casts:

```ts
return { token: (event as any).token as string };          // V1 reading-room
export const isInvalidCredentials = ({ event }: { event: any }) => …
```

So V1's `as any` spam wasn't sloppiness — the convention required it, while the mandate above
forbids it. The two rules contradicted each other. `types.ts` resolves it:

```ts
// types.ts
export type Context = {
  token: string;
  chapter: Chapter | null;
  errorMessage: string | null;
};

export type Event =
  | { type: "SET_TOKEN"; token: string }
  | { type: "RETRY" };
```

```ts
// machine.ts
import { createMachine } from "xstate";
import type { Context, Event } from "./types";

export const readerMachine = createMachine({
  types: {} as { context: Context; events: Event },
  id: "reader",
  initial: "idle",
  context: { token: "", chapter: null, errorMessage: null },
  states: { /* … */ },
});
```

Actions, guards, and actors now infer their parameters. **No casts anywhere.**

Still simple TypeScript: two type aliases, no `satisfies`, no explicit generics, no wrapper types.

### Style

- Actions use `assign` returning a plain object to merge into context. Side-effecting actions
  (fire-and-forget calls) are plain functions, not `assign`.
- Guards are plain functions returning boolean.
- Events are `{ type: "UPPER_SNAKE_CASE" }`.
- Components consume via `useMachine`; render on `state.matches("x")`, read `state.context.y`,
  transition with `send({ type: "EVENT" })`.

### Naming

`sanctuary` means the **expired/invalid link** state (`DESIGN.md` D8/D9). V1's reading-room
machine reused the word for end-of-chapter — don't. Call that one `finished`.

## API calls — always through `lib/fetcher.ts`

`mappedFetcher` is the only way this app talks to the API. **V1's skill mandated it but it was
never built**, so every actor hand-rolled `fetch` plus its own error class (`LoginError`,
`GrantFetchError` — duplicated per machine), and hardcoded `localhost` URLs reached review twice.

Build it in Phase 0. It owns:

- **The API base URL**, from env. Never hardcode a host.
- **`credentials: "include"`** on every request — the session cookie is scoped to the parent
  domain (D6), and a single call that forgets this fails in a way that looks like a backend bug.
- **One error shape carrying `status`**, so guards stay one-liners:
  `export const isNotFound = ({ event }) => event.error.status === 404;`
- JSON encoding/decoding, so actors read `return mappedFetcher.get("/grants/" + token)`.

---

# Architecture — three levels

Each level knows only its own concerns. This is the rule that keeps the root machine small.

| Level | Owner | Knows about |
|---|---|---|
| **0** | root machine (`src/pages/machine/`) | session state, and which page is showing |
| **1** | page machines (`src/pages/<page>/machine/`) | what happens inside one page |
| **2** | component machines (`src/components/<C>/machine/`) | async work inside one component |

**Nothing from a lower level may appear in a higher one.** If the root machine grows a field
named after a domain object (`token`, `grant`, `chapterId`), that is the symptom — it belongs to
a page.

**A component earns a `machine/` only if it owns async work or a lifecycle independent of its
page.** `PdfChamber` and `Companion` qualify. `ChapterList`, `SiteHeader`, `Button`,
`TextField`, `Spinner`, `ErrorNotice` do not — they render props.

**Page machines are independent, never invoked as children of the root machine.** Invoke a child
only when the parent must react to its state or cancel it; the root machine does neither. It only
cares which page is showing, which it knows from its own state. Invoking would force every child
event through the root's type surface and make page machines untestable in isolation. Pages own
their data with their own `useMachine` and call `useNavigation()` to move.

# File structure

Every folder — component or page — is `index.tsx` + `<Name>.css` + an optional `machine/`.
One rule, no exceptions.

```
src/
├── main.tsx                        mount, import global styles
├── App.tsx                         mounts Router + <Navigator/>. No logic.
│
├── styles/                         reset.css · tokens.css · global.css
├── lib/                            env.ts · fetcher.ts · labels.ts · locale.ts
│
├── components/
│   ├── Button/ · TextField/ · Spinner/ · ErrorNotice/
│   ├── SiteHeader/                 index.tsx · contents.ts (what shows, per page × session) · SiteHeader.css
│   ├── ChapterList/                index.tsx · ChapterRow.tsx · ChapterList.css
│   ├── PdfChamber/                 + machine/
│   └── Companion/                  + machine/
│
└── pages/
    ├── index.tsx                   THE NAVIGATOR — useMachine(navigationMachine),
    │                               provides NavigationContext, renders a page per state
    ├── useNavigation.ts            hook → [state, send] for any page
    ├── machine/                    THE ROOT MACHINE
    │   ├── types.ts · machine.ts · actions.ts · actors.ts · guards.ts · index.ts
    │   └── sync.ts                 URL → machine adapter
    │
    ├── login/                      index.tsx · login.css · machine/
    ├── home/                       index.tsx · home.css · machine/
    ├── opening/                    index.tsx · machine/        (/read/:chapterId)
    └── reader/                     index.tsx · reader.css · machine/
                                    + Sanctuary.tsx (shares the /r/:token route)
```

# The root machine — level 0

## Boundary

**Owns:** session state, and which page is showing.
**Does not own:** anything inside a page.

Context is **one field** — `user`. Events are **four**. Invokes are **two**. If it grows past
that, something from level 1 has leaked in.

## Shape: two parallel regions

```
navigation  (type: parallel)

├── session
│   ├── checking          invoke checkSession
│   │     onDone  → authenticated       assignUser
│   │     onError → anonymous
│   ├── anonymous         AUTHENTICATED → authenticated  [assignUser, goToHome]
│   ├── authenticated     LOGOUT → loggingOut
│   └── loggingOut        invoke logoutActor
│         onDone / onError → anonymous  [clearUser, goToLogin]
│
└── page
    ├── unknown           renders nothing — prevents a Home flash before the first ROUTE
    ├── home
    ├── login
    ├── opening           /read/:chapterId
    └── reader            /r/:token
```

**Why parallel, and not pages nested under auth states.** Auth status and which-page-you're-on
are independent dimensions. Nesting forces every page to pick a side, which made `/` impossible
to open logged-out and required `reader` to be special-cased as a top-level sibling.

With parallel regions, `session.checking` + `page.reader` is a valid state — that is exactly a
WhatsApp visitor on a phone with no cookie. **Because the page region never waits on the session
region, a token link can never be bounced to `/login` by a pending auth check.** `DESIGN.md` D1 is
satisfied structurally, not by a rule someone must remember.

## Root-level events

```
on ROUTE:                        (sync.ts is the only sender)
  guard isReaderPath   → .page.reader
  guard isLoginPath    → .page.login
  guard isOpeningPath  → .page.opening
  (default)            → .page.home

on NAVIGATE:  actions: pushUrl   ← no target
```

**Navigation is unidirectional: all of it flows through the URL.** `NAVIGATE` transitions
nothing — it pushes the URL, which returns as `ROUTE`. One path→state mapping, no canonical-path
table, and no machine↔URL loop to guard against.

| Event | Sent by |
|---|---|
| `ROUTE { path }` | `sync.ts` — mount, popstate, and after any `pushUrl` |
| `NAVIGATE { to }` | any page asking to move |
| `AUTHENTICATED { user }` | login page, after a successful call |
| `LOGOUT` | account block |

## Implementation inventory

**Actors** — `checkSession` (`GET /api/auth/me`) · `logoutActor` (`POST /api/auth/logout`).
Login is **not** here — it belongs to the login page, which needs `submitting` and error states
for its own form anyway.

**Guards** (bare named exports, matching `event.path`) — `isReaderPath` · `isLoginPath` ·
`isOpeningPath`.

**Actions** — `assignUser` · `clearUser` (both `assign`), plus three side-effecting router calls
that are **not** `assign`: `pushUrl` (from `event.to`) · `goToHome` · `goToLogin`.

**`sync.ts`** — on mount and on `popstate`, send `ROUTE { path: location.pathname }`. That is its
entire job; the machine never pushes URLs except through the three actions above.

## What each page machine owns

| Page | Its machine handles |
|---|---|
| `login` | `idle → submitting → error`; calls `loginActor`; sends `AUTHENTICATED` up |
| `home` | `loading → ready / empty / error`; the chapter list |
| `opening` | `resolving`; calls `resolveChapterActor`; then `NAVIGATE` to `/r/:token` |
| `reader` | `loading → reading → finished / sanctuary / error`; grant fetch; one-tap re-issue |

Protected pages enforce their own access: `opening` reads session status from the root context and
sends `NAVIGATE { to: "/login" }` if anonymous. It must **wait for `session.checking` to settle**
rather than assuming anonymous.

## Deliberate choices — do not relitigate

- **`checkSession` runs on boot for everyone**, including token visitors, who 401 harmlessly.
  One wasted request, in exchange for deleting a special case that would otherwise have to be
  remembered forever.
- **Unrecognised paths fall through to `home`**, not a 404 screen.
- **Logout clears the local session even if the API call fails** — a failed logout must not
  strand the user in an authenticated-looking UI.
- **No redirect-after-login.** Always land on home.
- **`locale()` is retained** from V1, typed to return `string`. V1 weakened it to `any` and the PR
  was blocked for it.

## Design intent

From `BUSINESS.md`, still binding for the chamber: **Apple-clean, not fancy. Uninterrupted** — no
timers, no progress bars, no session metadata, no nudges. Auto-fading chrome. Soft expiry, no
shouting.

This is why the companion panel sits silent until *you* open it (D14), and why Home shows a quiet
read/unread mark rather than progress bars (D11).

## Pitfalls from V1

- **Three competing Reading Room implementations** existed simultaneously (`ShardView`,
  `ReadingRoomView`, `pages/reading-room/`). Before building a screen, check nothing already does
  it. Delete what you replace.
- **Unplanned features landing on main.** The Oracle chatbot arrived in two unticketed commits.
  Features get designed first — see `DESIGN.md`.
- **Session persistence.** V1 shipped login without it and filed it as a future note. Rehydrate
  from `GET /api/auth/me` on boot.
