import type { User } from "../../machine";

export type Context = {
  /** Set once the call succeeds. The page hands it to the root machine. */
  user: User | null;
  errorMessage: string | null;
};

export type Event =
  | { type: "SUBMIT"; email: string; password: string }
  /** Typing in either field clears the error rather than scolding as you fix it. */
  | { type: "EDIT" };
