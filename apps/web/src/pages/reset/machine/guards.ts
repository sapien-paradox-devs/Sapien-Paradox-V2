import type { AnyEventObject } from "xstate";

import { ApiError } from "../../../lib/fetcher";
import type { Event } from "./types";

const MIN_LENGTH = 8;

/**
 * Checked here rather than only on the server so the reader is told before a
 * round trip. The server enforces the same rule — this is courtesy, not the gate.
 */
export const passwordLongEnough = ({ event }: { event: Event }) =>
  event.type === "SUBMIT" && event.password.length >= MIN_LENGTH;

export const passwordsMatch = ({ event }: { event: Event }) =>
  event.type === "SUBMIT" && event.password === event.confirm;

/**
 * 410 means the token is spent or expired. It is the one failure retrying
 * cannot fix, so it is the one that hides the form.
 */
export const isLinkDead = ({ event }: { event: AnyEventObject }) =>
  "error" in event && event.error instanceof ApiError && event.error.status === 410;

/** 422 — the server disagreed about length. Same message as the local check. */
export const isTooShort = ({ event }: { event: AnyEventObject }) =>
  "error" in event && event.error instanceof ApiError && event.error.status === 422;
