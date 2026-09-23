import type { AnyEventObject } from "xstate";

import { ApiError } from "../../../lib/fetcher";
import type { Event } from "./types";

export const fieldsPresent = ({ event }: { event: Event }) =>
  event.type === "SUBMIT" && event.email.trim().length > 0 && event.password.length > 0;

/** The login succeeded; is this account staff (D82)? */
export const isStaffUser = ({ event }: { event: AnyEventObject }) =>
  "output" in event &&
  typeof event.output === "object" &&
  event.output !== null &&
  "isStaff" in event.output &&
  event.output.isStaff === true;

export const isUnauthorized = ({ event }: { event: AnyEventObject }) =>
  "error" in event && event.error instanceof ApiError && event.error.status === 401;
