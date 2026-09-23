import type { User } from "../../machine";

export type Context = {
  user: User | null;
  errorMessage: string | null;
};

export type Event =
  | { type: "SUBMIT"; email: string; password: string }
  | { type: "EDIT" };
