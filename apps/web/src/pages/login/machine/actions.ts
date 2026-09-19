/**
 * Plain functions returning the context patch. `index.ts` wraps them in
 * `assign` inside `setup`, where XState can infer the types.
 */

import type { AnyEventObject } from "xstate";

import { labels } from "../../../lib/labels";
import type { User } from "../../machine";
import type { Context } from "./types";

export function clearError(): Pick<Context, "errorMessage"> {
  return { errorMessage: null };
}

/** Wrong password. Specific, so the reader is not left guessing at an outage. */
export function invalidCredentials(): Pick<Context, "errorMessage"> {
  return { errorMessage: labels.login.errorInvalid };
}

export function unexpectedFailure(): Pick<Context, "errorMessage"> {
  return { errorMessage: labels.login.errorGeneric };
}

export function linkSendFailed(): Pick<Context, "errorMessage"> {
  return { errorMessage: labels.login.linkErrorGeneric };
}

export function userFromLogin({ event }: { event: AnyEventObject }): Pick<Context, "user"> {
  const output = "output" in event ? event.output : null;
  return { user: isUser(output) ? output : null };
}

function isUser(value: unknown): value is User {
  return typeof value === "object" && value !== null && "email" in value;
}
