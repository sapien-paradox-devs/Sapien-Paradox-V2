import type { AnyEventObject } from "xstate";

import { ApiError } from "../../../lib/fetcher";
import type { Event } from "./types";

/** An empty field is not worth a round trip. */
export const fieldsPresent = ({ event }: { event: Event }) =>
  event.type === "SUBMIT" &&
  event.email.trim().length > 0 &&
  event.password.length > 0;

export const phonePresent = ({ event }: { event: Event }) =>
  event.type === "SEND_LINK" && event.phone.trim().length > 0;

/** 401 is a wrong password; anything else is a problem the reader cannot fix. */
export const isUnauthorized = ({ event }: { event: AnyEventObject }) =>
  "error" in event && event.error instanceof ApiError && event.error.status === 401;
