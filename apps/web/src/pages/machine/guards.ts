/**
 * Root guards. Individual named exports, imported as `import * as guards`.
 *
 * Each answers one question about a path. Anything unrecognised falls through
 * to home rather than a 404 (D15).
 */

import type { Event } from "./types";

function path(event: Event): string {
  return event.type === "ROUTE" ? event.path : "";
}

/** `/r/:token` — the only route that works without a session. */
export const isReaderPath = ({ event }: { event: Event }) =>
  path(event).startsWith("/r/");

export const isLoginPath = ({ event }: { event: Event }) => path(event) === "/login";

/** `/read/:chapterId` — swaps a chapter for a token, then redirects. */
export const isOpeningPath = ({ event }: { event: Event }) =>
  path(event).startsWith("/read/");
