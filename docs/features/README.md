# Feature pages

One page per feature of the product, backend and browser together. Twenty-one of them, plus a
contents page.

Each page answers the same four questions, in the same order:

1. **Why it exists** — the decision or the failure that produced it.
2. **The mechanism** — one diagram, drawn as SVG, of the thing prose describes worst.
3. **What each part does** — the code map: every file involved, in call order, and what it is
   responsible for.
4. **Gotchas** — what actually went wrong while building it, so it does not go wrong twice.

The set is reference material, not a plan. `docs/PLAN.md` holds the feature tree and the sequence of
work; `decisions/` holds the reasoning; these pages hold "what is in the code, and why is it shaped
like that".

## Reading them

Open `pages/index.html` in a browser. Every page is a standalone document with its styles inlined —
no build step, no server, no dependencies beyond two Google fonts.

## The pages

| # | Page | Capability |
|---|---|---|
| 01 | Platform Foundations | Foundations |
| 02 | The Ten Tables | Foundations |
| 03 | Machines On Both Sides | Foundations |
| 04 | Catalogue And Landing | Acquisition |
| 05 | Razorpay Checkout | Acquisition |
| 06 | Onboarding And Entitlement | Acquisition |
| 07 | Login And Session | Identity |
| 08 | Credentials And Recovery | Identity |
| 09 | Profile And Account | Identity |
| 10 | The Cadence Tick | Cadence |
| 11 | WhatsApp Delivery | Delivery |
| 12 | Grants And Sanctuary | Reading |
| 13 | The Reading Chamber | Reading |
| 14 | Reading Progress | Reading |
| 15 | The Home Shelf | Reading |
| 16 | The Companion Panel | Companionship |
| 17 | Reader Stewardship | Stewardship |
| 18 | The Book Workspace | Stewardship |
| 19 | Covers And Video | Stewardship |
| 20 | The Jewel Surface | Surface |
| 21 | Commands And Operations | Stewardship |

The seven capabilities are `docs/PLAN.md` §2's own tree, so a page and a branch of the tree name the
same thing. Surface is §2.9.

## Editing

```
manifest.json      title, one-line lede, decisions, status, and the artifact URL if published
parts/<slug>.html  the body of one page — sections only, no <head>, no styles
shell/style.css    the whole visual system, once, on the product's own Jewel tokens (D81)
shell/build.py     wraps each fragment and writes pages/<slug>.html + pages/index.html
```

```sh
python3 docs/features/shell/build.py                      # everything
python3 docs/features/shell/build.py 10-the-cadence-tick  # one page
python3 docs/features/shell/build.py --embed              # fragment form, for the Artifact tool
```

Never edit anything in `pages/` — it is generated, and the next build overwrites it.

`--embed` exists because a published Artifact supplies its own document skeleton and refuses a page
that brings one, while a file opened from disk needs the opposite.

## Status marks

The chip on each page is the feature's state: **built**, **partly built**, or **not started**, taken
from `docs/PLAN.md` §2. Where a feature has a gap, the gap is named on that feature's own page rather
than collected somewhere else — the same rule the decisions folder follows, for the same reason.
