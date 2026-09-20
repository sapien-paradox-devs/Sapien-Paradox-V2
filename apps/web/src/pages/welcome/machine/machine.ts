/**
 * The welcome page — level 1. Declarative config only.
 *
 * D48: this page fulfils. It is not decoration waiting on a webhook that may
 * never arrive — it is the leg the reader's own browser delivers, and the one
 * V1's spike actually relied on.
 *
 * Four outcomes, four things worth saying. The page previously had one state and
 * asserted a delivery, which is what a reader saw while a rejected webhook meant
 * nothing had been created at all.
 */
export const welcomeConfig = {
  id: "welcome",
  initial: "confirming",
  context: { delivered: false, detail: "" },

  states: {
    confirming: {
      invoke: {
        src: "confirmActor",
        onDone: [
          { guard: "isFulfilled", target: "fulfilled", actions: "assignOutcome" },
          { guard: "isPending", target: "pending", actions: "assignOutcome" },
          { target: "refused", actions: "assignOutcome" },
        ],
        // The purchase is not in doubt here; only our ability to confirm it is.
        onError: "failed",
      },
    },

    fulfilled: { type: "final" },
    pending: {},
    refused: {},
    failed: {},
  },
} as const;
