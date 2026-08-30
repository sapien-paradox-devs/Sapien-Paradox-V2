/**
 * Login page — level 1. Declarative config only.
 *
 * The root machine deliberately does not hold these states: `idle` and
 * `submitting` are this form's lifecycle, not navigation. D15 names that as the
 * level-1 leakage caught in its own second draft.
 *
 * Only the outcome travels up, as AUTHENTICATED.
 */

import type { Event } from "./types";

export const loginConfig = {
  id: "login",
  initial: "idle",
  context: { user: null, errorMessage: null },

  states: {
    idle: {
      on: {
        SUBMIT: { guard: "fieldsPresent", target: "submitting" },
      },
    },

    submitting: {
      invoke: {
        src: "loginActor",
        // Narrowed from the machine's own event union — annotating a narrower
        // shape here breaks inference for every state in the machine.
        input: ({ event }: { event: Event }) =>
          event.type === "SUBMIT"
            ? { email: event.email, password: event.password }
            : { email: "", password: "" },
        onDone: { target: "done", actions: "assignUser" },
        onError: [
          // A wrong password and a broken connection are different problems and
          // read differently to the person typing.
          { guard: "isUnauthorized", target: "error", actions: "showInvalid" },
          { target: "error", actions: "showUnexpected" },
        ],
      },
    },

    error: {
      on: {
        EDIT: { target: "idle", actions: "clearError" },
        SUBMIT: { guard: "fieldsPresent", target: "submitting" },
      },
    },

    // The page watches for this and hands the reader to the root machine.
    done: { type: "final" },
  },
} as const;
