"""Values shared with the frontend (D20).

`shared/constants.json` is the single source of truth. The backend builds WhatsApp links
from these route patterns and the frontend routes them — drift means every link in every
message 404s, which is why they live in one file rather than two.

Read at import, not cached lazily: a malformed constants file should fail at startup, not
on the first reader's request.
"""

import json
from pathlib import Path

_PATH = Path(__file__).resolve().parents[3] / "shared" / "constants.json"

with _PATH.open() as fh:
    _SHARED = json.load(fh)

PACE_KEYS = tuple(_SHARED["pace"])

# Neutral keys in the database, poetic labels in the UI (D19). "slow"/"medium"/"fast"
# never get migrated for a rename; Largo/Andante/Allegro live in labels.ts.
PACE_CHOICES = tuple((key, key) for key in PACE_KEYS)

ROUTES = _SHARED["routes"]
