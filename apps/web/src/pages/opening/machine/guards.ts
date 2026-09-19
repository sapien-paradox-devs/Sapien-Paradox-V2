import type { AnyEventObject } from "xstate";

import { ApiError } from "../../../lib/fetcher";
import type { Event } from "./types";

export const isAuthenticated = ({ event }: { event: Event }) =>
  event.type === "SESSION_SETTLED" && event.authenticated;

export const isForbidden = ({ event }: { event: AnyEventObject }) =>
  "error" in event && event.error instanceof ApiError && event.error.status === 403;
