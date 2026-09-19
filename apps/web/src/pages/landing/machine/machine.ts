/**
 * Landing — level 1. The public front door (D47).
 *
 *   loading → browsing → submitting → redirecting
 *           ↘ failed   ↖ refused ↙
 *
 * `redirecting` is final on purpose: the browser is leaving for Razorpay, so
 * there is no state after it. The reader returns at `/welcome` as a fresh load.
 *
 * `refused` returns to the form with everything still typed. Re-entering five
 * fields because the gateway hiccuped is its own insult, and D45 says a
 * refusal is a normal state rather than an error screen.
 */

import type { Context, Event } from "./types";

const initialContext: Context = { books: [], paymentUrl: null };

export const landingConfig = {
  id: "landing",
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

    browsing: { on: { SUBMIT: { target: "submitting" } } },

    submitting: {
      invoke: {
        src: "startCheckout",
        // `submitting` is only reachable from SUBMIT, and the mapper must return
        // a Signup rather than `Signup | null`. Narrow by throwing rather than
        // casting: mandate 4 forbids `as any`, and this states the invariant.
        input: ({ event }: { event: Event }) => {
          if (event.type !== "SUBMIT") {
            throw new Error("landing: submitting entered without a SUBMIT event");
          }
          return event.signup;
        },
        onDone: { target: "redirecting", actions: "assignPaymentUrl" },
        onError: { target: "refused" },
      },
    },

    refused: { on: { SUBMIT: { target: "submitting" } } },

    redirecting: { type: "final", entry: "leaveForPayment" },
  },
} as const;
