import type { AnyEventObject } from "xstate";

import { ApiError } from "../../../lib/fetcher";

function status(event: AnyEventObject): number | null {
  return "error" in event && event.error instanceof ApiError
    ? event.error.status
    : null;
}

/**
 * The link has rested. One tap fixes it, so this must stay distinct from
 * `denied`, which no button solves (D9, D25).
 */
export const isExpired = ({ event }: { event: AnyEventObject }) => {
  const code = status(event);
  return code === 404 || code === 410;
};

export const isForbidden = ({ event }: { event: AnyEventObject }) =>
  status(event) === 403;

/** Already sent. An outcome, not a failure (D45). */
export const isRateLimited = ({ event }: { event: AnyEventObject }) =>
  status(event) === 429;

/** The server says this request was the link's first open (#116). */
export const isFirstOpen = ({ event }: { event: AnyEventObject }) =>
  "output" in event &&
  typeof event.output === "object" &&
  event.output !== null &&
  "firstOpen" in event.output &&
  event.output.firstOpen === true;
