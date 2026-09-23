# Identity — how the product looks

D74

---

## D74 — Ink & Sage: the palette and the type

**Locked** 2026-09-24 · owner's call · amends the Fraunces note in D54 (`13-surface.md`)

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
