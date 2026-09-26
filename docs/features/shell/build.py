#!/usr/bin/env python3
"""Assemble one feature page per body fragment.

    python3 docs/features/shell/build.py [slug ...] [--embed]

Reads `manifest.json` and `parts/<slug>.html`, wraps the fragment in the shared
shell (title, topbar, masthead, chips, footer) with `shell/style.css` inlined,
and writes `pages/<slug>.html` plus `pages/index.html`.

By default each page is a **standalone HTML document** — doctype, head, body —
so it opens from the filesystem or from any static host. Pass `--embed` to emit
the fragment form instead (no doctype, no `<html>`/`<head>`/`<body>`), which is
what the Artifact tool expects, since it supplies its own skeleton.

The style lives once so twenty-one pages cannot drift apart. Edit the fragment
or the stylesheet, then rebuild.
"""

from __future__ import annotations

import html
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STATUS_WORD = {"built": "built", "partial": "partly built", "missing": "not started"}


def document(title: str, body: str, embed: bool) -> str:
    """A standalone HTML document, or the bare fragment when `embed` is set.

    The Artifact tool supplies its own skeleton and refuses a page that brings
    one; a file opened from disk needs the opposite. One flag, one difference.
    """
    if embed:
        return f"<title>{title}</title>\n{body}"

    return (
        "<!doctype html>\n"
        '<html lang="en">\n'
        "<head>\n"
        '<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        f"<title>{title}</title>\n"
        "</head>\n"
        f"<body>\n{body}</body>\n"
        "</html>\n"
    )


def shell(feature: dict, body: str, style: str, total: int, embed: bool = False) -> str:
    n = feature["n"]
    title = html.escape(feature["title"])
    lede = feature["lede"]
    status = feature["status"]

    chips = [f'<span class="chip cap">{html.escape(feature["capability"])}</span>']
    chips += [f'<span class="chip">{html.escape(d)}</span>' for d in feature["decisions"]]
    chips.append(f'<span class="chip {status}">{STATUS_WORD[status]}</span>')

    prev_next = []
    if n > 1:
        prev_next.append(f"&larr; {n - 1:02d}")
    if n < total:
        prev_next.append(f"{n + 1:02d} &rarr;")

    return document(f"{title}", f"""<style>
{style}</style>

<div class="topbar">
  <span class="num">{n:02d}</span>
  <span>{title}</span>
  <span class="set">Sapien Paradox V2 &middot; feature {n:02d} of {total}</span>
</div>

<div class="wrap">
  <header class="masthead">
    <h1>{title}</h1>
    <p class="lede">{lede}</p>
    <div class="chips">{"".join(chips)}</div>
  </header>

{body.rstrip()}

  <footer class="end">
    <p><a href="index.html">All features</a> &middot; {n:02d} of {total} &middot; source at
    <span class="mono">docs/features/parts/{feature["slug"]}.html</span></p>
    <p class="nav">{" &middot; ".join(prev_next)}</p>
  </footer>
</div>
""", embed)


def index(manifest: list[dict], style: str, embed: bool = False) -> str:
    """The contents page: every feature, grouped by capability, in order."""
    rows = []
    seen = None
    for feature in manifest:
        capability = feature["capability"]
        if capability != seen:
            rows.append(f'<h3>{html.escape(capability)}</h3>')
            seen = capability
        rows.append(
            '<div class="step">'
            f'<span class="n">{feature["n"]:02d}</span>'
            "<div>"
            f'<div class="where"><a href="{feature["slug"]}.html">{html.escape(feature["title"])}</a>'
            f' <em>{" · ".join(feature["decisions"][:4])}</em></div>'
            f'<div class="what">{feature["lede"]}</div>'
            "</div></div>"
        )

    return document("Sapien Paradox Features", f"""<style>
{style}</style>

<div class="topbar">
  <span class="num">00</span>
  <span>Contents</span>
  <span class="set">Sapien Paradox V2 &middot; {len(manifest)} features</span>
</div>

<div class="wrap">
  <header class="masthead">
    <h1>Sapien Paradox Features</h1>
    <p class="lede">Every feature in the product, backend and browser together: why it exists, the
    mechanism in one diagram, what each part of the code does, and what went wrong while building
    it.</p>
    <div class="chips">
      <span class="chip cap">{len(manifest)} pages</span>
      <span class="chip">7 capabilities</span>
      <span class="chip built">read in any order</span>
    </div>
  </header>

  <section>
    <h2>The pages</h2>
    <div class="map">
{chr(10).join("    " + row for row in rows)}
    </div>
  </section>

  <section>
    <h2>How this set is built</h2>
    <p>Each page is a body fragment in <span class="mono">parts/</span> wrapped by
    <span class="mono">shell/build.py</span> with one shared stylesheet, so twenty-one pages cannot
    drift apart. Edit a fragment or the stylesheet and rebuild:</p>
    <p><code>python3 docs/features/shell/build.py</code></p>
    <p>The status chip on each page says whether the feature is built, partly built or not started,
    and the gaps are named in the page's own last sections rather than collected
    elsewhere.</p>
  </section>
</div>
""", embed)


def main() -> int:
    manifest = json.loads((ROOT / "manifest.json").read_text())["features"]
    style = (ROOT / "shell" / "style.css").read_text()
    args = sys.argv[1:]
    embed = "--embed" in args
    wanted = {a for a in args if not a.startswith("--")}

    built = 0
    for feature in manifest:
        slug = feature["slug"]
        if wanted and slug not in wanted:
            continue
        part = ROOT / "parts" / f"{slug}.html"
        if not part.exists():
            if wanted:
                print(f"missing fragment: {part}")
            continue
        out = ROOT / "pages" / f"{slug}.html"
        out.write_text(shell(feature, part.read_text(), style, len(manifest), embed))
        print(f"{out.relative_to(ROOT.parent.parent)}  {out.stat().st_size // 1024}KB")
        built += 1

    contents = ROOT / "pages" / "index.html"
    contents.write_text(index(manifest, style, embed))
    print(f"{contents.relative_to(ROOT.parent.parent)}  {contents.stat().st_size // 1024}KB")

    print(f"{built} page(s) built")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
