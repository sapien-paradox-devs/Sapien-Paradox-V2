import type { AnyEventObject } from "xstate";

import { labels } from "../../../lib/labels";
import type { User } from "../../machine";
import type { Context } from "./types";

export function userFromLogin({ event }: { event: AnyEventObject }): Pick<Context, "user"> {
  const output = "output" in event ? event.output : null;
  return { user: isUser(output) ? output : null };
}

export function clearError(): Pick<Context, "errorMessage"> {
  return { errorMessage: null };
}

export function invalidCredentials(): Pick<Context, "errorMessage"> {
  return { errorMessage: labels.login.errorInvalid };
}

export function unexpectedFailure(): Pick<Context, "errorMessage"> {
  return { errorMessage: labels.login.errorGeneric };
}

function isUser(value: unknown): value is User {
  return typeof value === "object" && value !== null && "email" in value && "isStaff" in value;
}
