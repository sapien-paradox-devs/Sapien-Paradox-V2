/**
 * The shared constants (D20), re-exported with real types.
 *
 * `shared/constants.json` is the single source of truth: the backend builds WhatsApp links
 * from these route patterns and the frontend routes them. Drift means every link in every
 * message 404s — which is why they live in one file rather than two.
 *
 * D20 assumed `as const` would preserve literal unions. It doesn't for JSON imports —
 * TypeScript widens `["slow","medium","fast"]` to `string[]`, so the union has to be
 * declared here. That declaration is the one place the two files can drift, so
 * `assertPaceInSync` re-checks it at module load: a mismatch fails loudly at boot rather
 * than silently sending a pace the backend rejects.
 */

import shared from "@shared/constants.json";

export type Pace = "slow" | "medium" | "fast";

const DECLARED_PACE: readonly Pace[] = ["slow", "medium", "fast"];

function assertPaceInSync(): readonly Pace[] {
  const fromJson = shared.pace;

  const matches =
    fromJson.length === DECLARED_PACE.length &&
    DECLARED_PACE.every((value, index) => fromJson[index] === value);

  if (!matches) {
    throw new Error(
      `shared/constants.json pace [${fromJson.join(", ")}] does not match the Pace type ` +
        `[${DECLARED_PACE.join(", ")}]. Update src/lib/constants.ts.`,
    );
  }

  return DECLARED_PACE;
}

export const PACE = assertPaceInSync();

/**
 * Days between chapters for each pace — **display only**, for the landing
 * page's "when your chapters would arrive" strip (#149).
 *
 * The backend owns the real schedule (`CADENCE_INTERVAL_DAYS`, #112), and it is
 * env-overridable so a test deployment can shrink it. These are the defaults
 * the pace labels already promise ("a chapter a week", …). When #112 lands and
 * both sides read the value, it moves to `shared/constants.json` (D20).
 */
export const PACE_INTERVAL_DAYS: Record<Pace, number> = { slow: 7, medium: 3, fast: 1 };

export const ROUTES = shared.routes;
