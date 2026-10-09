import type { AnyEventObject } from "xstate";

import { ApiError } from "../../../lib/fetcher";
import type { Event } from "./types";

export const isAuthenticated = ({ event }: { event: Event }) =>
  event.type === "SESSION_SETTLED" && event.authenticated;

export const isForbidden = ({ event }: { event: AnyEventObject }) => refused(event, 403);

/** Cadence has not released this chapter yet (#114). Owned, but not yet. */
export const isLocked = ({ event }: { event: AnyEventObject }) => refused(event, 409);

function refused(event: AnyEventObject, status: number): boolean {
  return "error" in event && event.error instanceof ApiError && event.error.status === status;
}
