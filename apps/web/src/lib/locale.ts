/**
 * The dot-notation reader over `labels.ts` that `apps/web/CLAUDE.md` mandates.
 *
 * Typed to return `string` — V1 weakened this to `any` and the PR was blocked for
 * it (mandate 3). A path is an ordinary string, not a typed union of valid keys,
 * so a copy typo cannot be caught at compile time. The tradeoff is made safe by
 * failing loudly in development: a missing key throws immediately, at the call
 * site, rather than rendering the dotted path itself as if it were copy. In
 * production it falls back to the path so one bad key degrades instead of
 * crashing the page a reader is looking at.
 */

import { labels } from "./labels";

type Dict = { [key: string]: string | Dict };

function isDict(value: unknown): value is Dict {
  return typeof value === "object" && value !== null;
}

export function locale(path: string): string {
  const parts = path.split(".");
  let current: string | Dict = labels;

  for (const part of parts) {
    if (!isDict(current) || !(part in current)) {
      return missing(path);
    }
    current = current[part];
  }

  if (typeof current !== "string") {
    return missing(path);
  }

  return current;
}

function missing(path: string): string {
  if (import.meta.env.DEV) {
    throw new Error(`locale(): no string at "${path}"`);
  }

  return path;
}
