/**
 * Set-a-password page — level 1. Declarative config only.
 *
 * This is the other half of D26. A reader created by onboarding has an
 * *unusable* password, so login can never work for them; the WhatsApp link to
 * `/reset/:token` is their only way in. The backend for it shipped with the
 * reset endpoints — this is the screen that was missing, which left the link
 * dead-ending and the reader staring at a sign-in form they have no password for.
 *
 * `token` arrives as machine input, not as an event: it comes from the URL and
 * never changes for the life of the page.
 */

import type { Event } from "./types";

export const resetConfig = {
  id: "reset",
  initial: "idle",
  context: ({ input }: { input: { token: string } }) => ({
    token: input.token,
    errorMessage: null,
    linkDead: false,
  }),

  states: {
    idle: {
      on: {
        EDIT: { actions: "clearError" },

        // Checked cheapest-first: both local rules before a round trip, and
        // each with its own message, because "invalid" tells the reader nothing.
        SUBMIT: [
          { guard: "passwordTooShort", actions: "showTooShort" },
          { guard: "passwordsDiffer", actions: "showMismatch" },
          { target: "submitting" },
        ],
      },
    },

    submitting: {
      invoke: {
        src: "confirmActor",
        // Narrowed from the machine's own event union — annotating a narrower
        // shape here breaks inference for every state in the machine.
        input: ({ context, event }: { context: { token: string }; event: Event }) => ({
          token: context.token,
          password: event.type === "SUBMIT" ? event.password : "",
        }),
        onDone: { target: "done" },
        onError: [
          // A spent link is terminal: no target back to idle, because there is
          // nothing the reader can retype that would make it work.
          { guard: "isLinkDead", target: "dead", actions: "showLinkDead" },
          { guard: "isTooShort", target: "idle", actions: "showTooShort" },
          { target: "idle", actions: "showUnexpected" },
        ],
      },
    },

    /** Terminal. The page offers the one thing that still helps: sign in. */
    dead: {},

    done: { type: "final" },
  },
} as const;
