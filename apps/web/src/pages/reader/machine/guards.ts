import type { AnyEventObject } from "xstate";

import { PROGRESS_STEP } from "./actions";
import type { Context, Event } from "./types";

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

/** The chapter was already marked complete — reopen it at its end state (D70). */
export const isCompleted = ({ event }: { event: AnyEventObject }) =>
  "output" in event &&
  typeof event.output === "object" &&
  event.output !== null &&
  "completed" in event.output &&
  event.output.completed === true;

// ── the progress region (D70) ──────────────────────────────────────────

/** Further than the reader has been. */
export const isFurther = ({ context, event }: { context: Context; event: Event }) =>
  event.type === "PROGRESS" && event.fraction > context.latest;

/** Far enough past what the server has to be worth a request — and not after completing. */
export const movedEnough = ({ context, event }: { context: Context; event: Event }) =>
  !context.completed &&
  event.type === "PROGRESS" &&
  event.fraction - context.sent >= PROGRESS_STEP;

/** Something the server has not been told yet. */
export const hasUnsent = ({ context }: { context: Context }) =>
  !context.completed && context.latest - context.sent >= PROGRESS_STEP;

/** The reader kept going while the last save was in flight. */
export const moreToSend = ({ context, event }: { context: Context; event: AnyEventObject }) =>
  "output" in event &&
  typeof event.output === "number" &&
  !context.completed &&
  context.latest - event.output >= PROGRESS_STEP;
