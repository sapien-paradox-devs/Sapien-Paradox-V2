import type { AnyEventObject } from "xstate";

import { ApiError } from "../../lib/fetcher";
import { labels } from "../../lib/labels";
import type { Refusal } from "./types";

/** The `{ code, field }` of a 409 from an admin endpoint, or null for anything else. */
export function refusalOf(event: AnyEventObject): Refusal | null {
  if (!("error" in event) || !(event.error instanceof ApiError)) return null;
  if (event.error.status !== 409 || !event.error.code) return null;
  return { code: event.error.code, field: event.error.field };
}

/** A refusal code in words. Unknown codes fall back to a plain "refused". */
export function refusalText(code: string): string {
  const known: Record<string, string> = labels.admin.refusals;
  return known[code] ?? labels.admin.refusals.refused;
}
