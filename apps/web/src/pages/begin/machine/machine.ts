/**
 * Begin — level 1. Where a book is bought (D47), on its own page (#160).
 *
 *   loading → browsing → submitting → paying → redirecting
 *           ↘ failed   ↖ refused ↙ ↖ browsing (dismissed)
 *
 * `submitting` creates a Razorpay order. `paying` opens the Standard Checkout
 * modal, waits for payment, then verifies with the backend — all inside one
 * actor. `redirecting` navigates to `/welcome`.
 *
 * `refused` returns to the form with everything still typed. Re-entering five
 * fields because the gateway hiccuped is its own insult, and D45 says a
 * refusal is a normal state rather than an error screen.
 */

import type { Context } from "./types";

const initialContext: Context = { books: [], orderDetails: null, signup: null };

export const beginConfig = {
  id: "begin",
  initial: "loading",
  context: initialContext,

  states: {
    loading: {
      invoke: {
        src: "fetchBooks",
        onDone: { target: "browsing", actions: "assignBooks" },
        onError: { target: "failed" },
      },
    },

    failed: { on: { RETRY: { target: "loading" } } },

    browsing: { on: { SUBMIT: { target: "submitting", actions: "assignSignup" } } },

    submitting: {
      invoke: {
        src: "startCheckout",
        input: ({ context }: { context: Context }) => {
          if (!context.signup) {
            throw new Error("begin: submitting entered without a signup");
          }
          return context.signup;
        },
        onDone: { target: "paying", actions: "assignOrderDetails" },
        onError: { target: "refused" },
      },
    },

    paying: {
      invoke: {
        src: "payAndConfirm",
        input: ({ context }: { context: Context }) => ({
          orderDetails: context.orderDetails!,
          signup: context.signup!,
        }),
        onDone: { target: "redirecting" },
        onError: [
          { guard: "isDismissed", target: "browsing" },
          { target: "refused" },
        ],
      },
    },

    refused: { on: { SUBMIT: { target: "submitting", actions: "assignSignup" } } },

    redirecting: { type: "final", entry: "navigateToWelcome" },
  },
} as const;
