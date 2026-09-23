# Identity — how the product looks

D74, D81

---

## D74 — Ink & Sage: the palette and the type

**Locked** 2026-09-24 · owner's call · amends the Fraunces note in D54 (`13-surface.md`)

> **Palette superseded by D81** (below), the same day. The type (Newsreader + Inter) stands.

### Why it changed

The first surface (#115–#126) used warm cream paper, a burnt-sienna accent and Fraunces, a soft
display serif. The owner's verdict: it *looks like Claude's own design*. That palette sits very
close to Claude's brand, and a product that borrows someone else's look is harder to remember as
its own. The layout, spacing, motion and restraint were kept. Only the palette and type changed.

### The palette

| Token | Light | Dark |
|---|---|---|
| `--paper` | `#F5F6F2` cool off-white | `#101714` |
| `--paper-raised` | `#FBFCFA` | `#17201C` |
| `--paper-sunk` | `#ECEEE8` | `#0B110E` |
| `--ink` | `#16211C` green-black | `#E4EBE6` |
| `--ink-soft` | `#56625B` | `#AAB6AF` |
| `--ink-faint` | `#5E6A63` | `#8D9A92` |
| `--accent` | `#2F6B4F` forest sage | `#7FB89A` |
| `--accent-hover` | `#245640` | `#97C9AE` |
| `--on-accent` | `#FFFFFF` | `#101714` |
| `--danger` | `#A13A30` | `#E58A80` |
| `--good` | `#2F6B4F` | `#93C29A` |

**Every text/ground pair clears WCAG AA (4.5:1) in both themes.** The lowest is light
`--ink-faint` on `--paper-sunk` at 4.83. The old light `--ink-faint` failed at 3.36; this fixes
that too.

### The type

- **Newsreader** for headings and anything read at length: a book serif with an optical-size
  axis (6–72) and a true italic. Set with `opsz`; no novelty axes.
- **Inter** for interface text, unchanged.
- **Fraunces is retired**, and with it the SOFT/WONK axes D54 mentions. The threshold numeral
  keeps its moment with Newsreader at its largest optical size.

### Where it lives

`apps/web/src/styles/global.css` is the only source of truth. The copies that cannot read CSS
(`lib/theme.ts`'s browser-bar colours, `index.html`'s pre-paint script and `theme-color`, the
web manifest, the brand sources in `apps/web/brand/` and the watermark ink in
`services/pages.py`) change with it, in the same PR.

### Rejected

- **Midnight & Indigo** (navy ink, indigo accent, Literata). Crisp, but more "software" than
  "book".
- **Stone & Oxblood** (charcoal, wine red, Libre Caslon). Bookish, but red reads as an error
  colour on buttons.
- **Keeping the current look.** It is the reason for this decision.

**Revisit if** the brand gets a designer: this is a considered default, not a brand system.

---

## D81 — Jewel: a bright four-colour palette on the old near-black

**Locked** 2026-09-24 · owner's call · supersedes D74's palette; D74's type stands

### Why it changed

The owner's verdict on Ink & Sage: the green-black text colour doesn't look good, the forest-sage
accent is too muted, and one accent is too few. They asked for bright colours, more than two of
them, and the near-black the product had before D74.

### Decision

- **Text** goes back to the pre-D74 warm near-black, `#1F1B16`.
- **Paper** keeps D74's cool off-white. The cream was half of what made the first look read as
  Claude's own, and the owner only asked for the black back.
- **Four colours, one leading.** Each has a *bright* shade for fills (buttons, covers, bars,
  badges) and a *deep* shade for text on paper. Bright shades are never used as small text on
  paper: they fail contrast there, and that is the trap a bright palette sets.

| Role | Colour | Light: bright / text | Dark |
|---|---|---|---|
| **Main** — buttons, links, focus | cobalt | `#2952E3` / `#2952E3` (hover `#1F42C2`) | `#8FA8FF` (hover `#AFC0FF`) |
| Highlights, progress | saffron | `#F5A623` / `#9A5B00` | `#FFC152` |
| Covers, chapter numerals | coral | `#FF6B57` / `#C23A28` | `#FF8A7A` |
| Covers, "new" marks | teal | `#14B8A6` / `#0A7266` | `#3DD6C3` |

| Token | Light | Dark |
|---|---|---|
| `--ink` | `#1F1B16` | `#ECE4D6` |
| `--ink-soft` | `#5D554A` | `#B9AE9D` |
| `--ink-faint` | `#6B6358` | `#9A9083` |
| `--paper` | `#F5F6F2` | `#16130F` |
| `--paper-raised` | `#FBFCFA` | `#1F1B16` |
| `--paper-sunk` | `#ECEEE8` | `#100E0B` |
| `--on-accent` | `#FFFFFF` | `#16130F` |
| `--danger` | `#B42318` | `#FF8A80` |

**Every text/ground pair clears WCAG AA (4.5:1) in both themes**, checked against all three paper
tokens. The lowest are deep coral at 4.57 and deep saffron at 4.64. White on cobalt is 6.16. Near-black
text on the bright saffron, coral and teal fills is 6.1 to 8.5, so labels on covers and badges use
the ink colour, not white.

**Coral stays off buttons and alerts.** Its deep shade sits close to `--danger`, so a coral button
would read as a warning. It is a cover and ornament colour.

### Where it lives

Unchanged from D74: `global.css` is the only source, and the copies that cannot read CSS change in
the same PR (`lib/theme.ts`, `index.html`, the manifest, `apps/web/brand/`, the watermark ink in
`services/pages.py`).

### Rejected

- **Sunrise** (vermilion, amber, magenta, violet). The loudest, and a vermilion button reads as a
  warning.
- **Pop** (ultramarine, tangerine, fuchsia, lemon). The least bookish, and lemon can never be text.
- **Reverting to the pre-D74 look entirely.** Brings back the cream and terracotta that D74 left for
  a reason; the owner asked only for the black.

**Revisit if** the brand gets a designer, as with D74.
