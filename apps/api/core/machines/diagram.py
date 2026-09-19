"""Render a Spec as Mermaid.

Generated from the transition table itself, so the picture cannot drift from
the code the way a hand-drawn one does — which was the point of asking for a
diagram at all (D37).

Mermaid rather than Graphviz: it needs no system package, and GitHub renders it
inline in a pull request, so a reviewer sees the shape of a rule change.
"""

from . import Spec


def _label(row):
    """`EVENT [guard, guard]` — the trigger, and what has to be true."""
    guards = ", ".join(g.__name__ for g in row.get("conditions", []))
    return f"{row['trigger']} [{guards}]" if guards else row["trigger"]


def to_mermaid(spec: Spec) -> str:
    lines = ["stateDiagram-v2", f"    %% {spec.name}", f"    [*] --> {spec.initial}"]

    for row in spec.transitions:
        sources = row["source"]
        if isinstance(sources, str):
            sources = [sources]
        for source in sources:
            # `dest: None` is an internal transition — it runs its action and
            # stays put, which is what every refusal does.
            dest = row["dest"] or source
            lines.append(f"    {source} --> {dest}: {_label(row)}")

    return "\n".join(lines)
