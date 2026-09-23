/**
 * Admin sign-in — level 1 (D82). Declarative config only.
 *
 * The same `POST /api/auth/login` as readers use, so there is one login system
 * with two doors. What differs is the outcome: a staff account ends in `done`
 * and is carried to `/admin`; any other account ends in `notStaff`, which says
 * so and goes nowhere. The API refuses non-staff on every admin endpoint
 * regardless; this state only keeps the page honest.
 */

import type { Event } from "./types";

export const adminLoginConfig = {
  id: "adminLogin",
  initial: "idle",
  context: { user: null, errorMessage: null },

  states: {
    idle: {
      on: { SUBMIT: { guard: "fieldsPresent", target: "submitting" } },
    },

    submitting: {
      invoke: {
        src: "loginActor",
        input: ({ event }: { event: Event }) =>
          event.type === "SUBMIT"
            ? { email: event.email, password: event.password }
            : { email: "", password: "" },
        onDone: [
          { guard: "isStaffUser", target: "done", actions: "assignUser" },
          { target: "notStaff" },
        ],
        onError: [
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

    notStaff: {
      on: {
        EDIT: { target: "idle", actions: "clearError" },
        SUBMIT: { guard: "fieldsPresent", target: "submitting" },
      },
    },

    // The page watches for this and hands the admin to the root machine.
    done: { type: "final" },
  },
} as const;
