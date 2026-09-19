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
        REQUEST_LINK: { target: "linkForm", actions: "clearError" },
      },
    },

    /*
     * The way in for a reader who has never had a password. D26 gives them an
     * unusable one, so the form above can never admit them; without this their
     * only key is a WhatsApp link that expires in an hour and cannot be re-asked
     * for.
     */
    linkForm: {
      on: {
        SEND_LINK: { guard: "phonePresent", target: "sendingLink" },
        EDIT: { actions: "clearError" },
        BACK: { target: "idle", actions: "clearError" },
      },
    },

    sendingLink: {
      invoke: {
        src: "requestLinkActor",
        input: ({ event }: { event: Event }) =>
          event.type === "SEND_LINK" ? { phone: event.phone.trim() } : { phone: "" },
        onDone: { target: "linkSent" },
        onError: { target: "linkForm", actions: "showLinkFailed" },
      },
    },

    /*
     * Deliberately says "if that number is on an account". The endpoint answers
     * identically for a known and an unknown number so it cannot be used to
     * discover who has an account; saying "sent!" here would undo that.
     */
    linkSent: {
      on: {
        BACK: { target: "idle", actions: "clearError" },
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
