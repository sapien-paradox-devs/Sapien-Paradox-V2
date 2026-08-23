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
