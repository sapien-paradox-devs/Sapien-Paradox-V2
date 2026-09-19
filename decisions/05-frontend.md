# Frontend architecture

D15

Full implementation spec lives in `apps/web/CLAUDE.md`. This records *why*.

---

## D15 — Three levels; the root machine is two parallel regions

**Locked** 2026-08-09

### Three levels

| Level | Owner | Knows about |
|---|---|---|
| 0 | root machine (`src/pages/machine/`) | session state, and which page is showing |
| 1 | page machines (`src/pages/<page>/machine/`) | what happens inside one page |
| 2 | component machines (`src/components/<C>/machine/`) | async work inside one component |

**Nothing from a lower level may appear in a higher one.** Diagnostic: if the root machine grows a
field named after a domain object (`token`, `grant`, `chapterId`), level 1 has leaked into level 0.
Its context is **one field** — `user`.

This rule was arrived at by correction. The first draft of the root machine carried grant fetching,
sanctuary sub-states, `finished`, and retry — three levels of work in one machine. The second draft
still had `login.idle` / `login.submitting`, which is the login page's UI lifecycle, not
navigation.

**A component earns a `machine/` only if it owns async work or a lifecycle independent of its
page.** `PdfChamber` and `Companion` qualify; `ChapterList`, `AccountBlock`, `Button`, `TextField`,
`Spinner`, `ErrorNotice` do not. Without this rule, "components have their own machines" becomes
twelve machines for five screens.

### Parallel regions, not pages nested under auth states

```
navigation (type: parallel)
├── session   checking · anonymous · authenticated · loggingOut
└── page      unknown · home · login · opening · reader
```

**Why:** auth status and which-page-you're-on are independent dimensions. Nesting forces every page
to pick a side — which made `/` impossible to open logged-out and required `reader` to be
special-cased as a top-level sibling.

With parallel regions, `session.checking` + `page.reader` is a valid state — **exactly a WhatsApp
visitor on a cookie-less phone.** Because the page region never waits on the session region, a
token link cannot be bounced to `/login` by a pending auth check.

**This deleted two footguns that were previously handled by rules:**
1. `reader` needing to be a top-level sibling "or every WhatsApp link dies."
2. The machine starting at `idle` rather than `booting` so a token link would skip the session
   check.

Both are now impossible by construction. That is the signal it is the right shape.

### Navigation is unidirectional through the URL

`NAVIGATE { to }` transitions nothing — it pushes the URL, which returns as `ROUTE`. One
path→state mapping, no canonical-path table, no machine↔URL loop to guard against.

### Page machines are independent, never invoked as children

**Invoke a child machine only when the parent must react to its state or cancel it.** The root
machine does neither — it only cares which page is showing, which it knows from its own state.

**Rejected — invoking page machines as children** (for "one tree"): forces every child event
through the root's type surface, so the root grows with every page, and makes page machines
untestable without booting the root and driving it into position. The tree is delivered by the
navigation hierarchy itself (`chamber.sanctuary.sending` is a real nested path), not by a
machine-of-machines.

Pages own their data with their own `useMachine` and call `useNavigation()` to move.

### Settled details

- **`checkSession` runs on boot for everyone**, including token visitors, who 401 harmlessly. One
  wasted request, in exchange for deleting a special case that would otherwise have to be
  remembered forever.
- **Unrecognised paths fall through to `home`**, not a 404 screen.
- **Logout clears the local session even if the API call fails** — a failed logout must not strand
  the user in an authenticated-looking UI.
- **No redirect-after-login.** Always land on home. The only protected deep link is
  `/read/:chapterId`, reached only from Home, where you are already authenticated.
- **`finished` is a real state**, rendered minimally — it is the anchor D14's deferred
  end-of-chapter companion question attaches to.

---

## D41 — The four page machines

**Locked** 2026-08-30 · **extends D15 downward**

D15 fixed the three levels and the root machine. Each page machine was left as one line — a
summary, not a design. These are the four, in full.

| Page | States |
|---|---|
| `login` | `idle → submitting → error` |
| `home` | two regions: `list` (`loading → ready · empty · error`) and `send` |
| `opening` | `waiting → resolving → done · denied · error` |
| `reader` | `loading → reading → finished · sanctuary · denied · error` |

**Failure states are named for what the reader can do about them, not for the status code.**
`sanctuary` offers a fresh link in one tap (D9); `denied` has no button that helps (D25);
`limited` means it already worked and they should check WhatsApp (D31). Collapsing any of these
into a generic `error` throws away the only information that decides what to render.

`sanctuary` means an expired or invalid link and nothing else. The end of a chapter is `finished`
— V1 used one word for both.

**Rejected — one shared `error` state per page**, with a message string in context. Cheaper, and
it makes the difference between "tap here" and "there is nothing you can do" a matter of
remembering to check a string.

---

## D42 — `home` and `reader` use parallel regions for in-flight work

**Locked** 2026-08-30

"Send this chapter to my WhatsApp" and "re-issue this dead link" are requests that happen *while*
something is already on screen. A single sequence of states would have to leave `ready` to
represent "sending", which blanks the chapter list for the duration of one button press.

Same reasoning as the root machine's two regions (D15): these are independent dimensions, and
nesting them forces one to wait on the other for no reason.

---

## D43 — `PdfChamber` owns its own error

**Locked** 2026-08-30

A grant can resolve perfectly and the PDF still fail — a broken byte range, a worker that did not
load. Folding that into the reader page's `error` tells a reader whose link is fine that their
link is broken, and offers them sanctuary, which cannot help.

The component keeps its own `idle → loading → rendered → error`, and the chamber stays standing
while the document retries.

This is also why `PdfChamber` is one of only two components that earns a machine (D15): it owns
async work with a lifecycle genuinely independent of its page.

---

## D44 — `opening` starts in `waiting` and never assumes anonymous

**Locked** 2026-08-30

On a hard refresh the session region is still `checking`. Treating "not yet authenticated" as
"anonymous" bounces a legitimate reader to `/login` — a bug that appears only on reload, only for
signed-in readers, and never in development, where the session check resolves instantly.

So the page waits for the session region to settle before deciding anything.

**This is the one sanctioned place where level 1 reads level 0**, and the reason the root machine
exposes `user` at all. It is narrow on purpose: reading *session status* is allowed; reading
anything else from the root is the leakage D15 warns about.

---

## D45 — Rate-limited is a normal state, not an error

**Locked** 2026-08-30

D31 counts rate limits from existing rows, which makes hitting one an ordinary outcome: the reader
asked twice, and the first one worked. The copy is "already sent — check WhatsApp".

Rendering it as a failure tells someone that something broke when nothing did, and invites them to
press the button again.

Applies everywhere it appears: Home's send button, and sanctuary's re-issue.
