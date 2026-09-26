import type { AnyEventObject } from "xstate";

import type { Context, Profile } from "./types";

export function profileFrom({ event }: { event: AnyEventObject }): Pick<Context, "profile"> {
  const output = "output" in event ? (event.output as Profile) : null;
  return { profile: output };
}

export function emailTakenError(): Pick<Context, "saveError"> {
  return { saveError: "email_taken" };
}

export function saveError(): Pick<Context, "saveError"> {
  return { saveError: "generic" };
}

export function clearSaveError(): Pick<Context, "saveError"> {
  return { saveError: null };
}

export function wrongPasswordError(): Pick<Context, "passwordError"> {
  return { passwordError: "wrong_password" };
}

export function tooShortError(): Pick<Context, "passwordError"> {
  return { passwordError: "too_short" };
}

export function passwordError(): Pick<Context, "passwordError"> {
  return { passwordError: "generic" };
}

export function clearPasswordError(): Pick<Context, "passwordError"> {
  return { passwordError: null };
}
