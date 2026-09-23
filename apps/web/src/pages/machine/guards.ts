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

/**
 * `/reset/:token` — the WhatsApp set-a-password link. Like `/r/:token` it must
 * work with no session: a reader with an unusable password cannot sign in first.
 */
export const isResetPath = ({ event }: { event: Event }) =>
  path(event).startsWith("/reset/");

/** `/begin` — buying a book, on its own page (#160). */
export const isBeginPath = ({ event }: { event: Event }) => path(event) === "/begin";

/** `/welcome` — where Razorpay returns the reader after paying (D47). */
export const isWelcomePath = ({ event }: { event: Event }) => path(event) === "/welcome";
