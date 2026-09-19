/**
 * Plain functions returning the context patch. `index.ts` wraps them in
 * `assign` inside `setup`, where XState can infer the types.
 */

import { labels } from "../../../lib/labels";
import type { Context } from "./types";

export function clearError(): Pick<Context, "errorMessage"> {
  return { errorMessage: null };
}

export function showTooShort(): Pick<Context, "errorMessage"> {
  return { errorMessage: labels.reset.tooShort };
}

export function showMismatch(): Pick<Context, "errorMessage"> {
  return { errorMessage: labels.reset.mismatch };
}

export function showUnexpected(): Pick<Context, "errorMessage"> {
  return { errorMessage: labels.reset.errorGeneric };
}

/** The link is spent. The form is hidden, so the copy must stand on its own. */
export function showLinkDead(): Pick<Context, "errorMessage" | "linkDead"> {
  return { errorMessage: labels.reset.expired, linkDead: true };
}
