#!/bin/bash
# Asks V1-or-V2 at session start, then auto-injects STATUS.md (current focus,
# next action, open questions). V1 is the parent repo and read-only reference.
set -e
PROJ="${CLAUDE_PROJECT_DIR:-$(pwd)}"
STATUS="$PROJ/STATUS.md"

if [ -f "$STATUS" ]; then
  STATUS_CONTENT=$(cat "$STATUS")
else
  STATUS_CONTENT="(no STATUS.md found — expected at repo root.)"
fi

BANNER="════════════════════════════════════════════════════════════════
  ASK THE USER BEFORE DOING ANYTHING ELSE:  \"Is this session for V1 or V2?\"
════════════════════════════════════════════════════════════════

You are in the **V2** repo (\`Sapien Paradox V2\`) — the active rebuild.

  V2 = this repo. Same product as V1, rebuilt so every piece is deliberate.
  V1 = ../Sapien Paradox App  — the PARENT repo. Read-only REFERENCE only.
       Consult it for prior art and provenance; never plan or build there,
       and never treat its models, tickets, open PRs or test failures as
       constraints on V2.

Before proposing anything structural, read \`decisions/README.md\` — decisions
are numbered (D1...) and record rejected alternatives with V1 provenance. The
option you are about to suggest may already be ruled out for a stated reason.

Decisions live in \`decisions/\` and NOWHERE ELSE. The same decision written in
two places is a bug — V1 died of exactly that.

Ask the question. Do not guess which one they mean.
────────────────────────────────────────────────────────────────"

# Inventory every doc in the repo, so nothing is invisible. V1's failure mode was
# design docs existing and never being found. git ls-files respects .gitignore,
# so vendored/venv markdown never appears.
INVENTORY=$(cd "$PROJ" && git ls-files "*.md" 2>/dev/null | sort | sed "s|^|  |")
[ -z "$INVENTORY" ] && INVENTORY="  (none tracked)"

CONTEXT="$BANNER

Every markdown doc in this repo (read the relevant one BEFORE designing —
do not assume a topic is undocumented):
$INVENTORY

STATUS.md, DESIGN.md and decisions/README.md are imported via CLAUDE.md and are
already in context — do not re-read them with a tool call.

Current state (auto-injected from STATUS.md):

$STATUS_CONTENT"

jq -n --arg c "$CONTEXT" '{
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: $c
  }
}'
