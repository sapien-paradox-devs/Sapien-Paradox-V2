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
  context: { delivered: false, detail: "", resend: null },

  states: {
    confirming: {
      invoke: {
        src: "confirmActor",
        onDone: [
          { guard: "isFulfilled", target: "fulfilled", actions: "assignOutcome" },
          { guard: "isOwned", target: "owned", actions: "assignOutcome" },
          { guard: "isPending", target: "pending", actions: "assignOutcome" },
          { target: "refused", actions: "assignOutcome" },
        ],
        // The purchase is not in doubt here; only our ability to confirm it is.
        onError: "failed",
      },
    },

    /*
     * Not final any more. A reader whose chapter did not leave — the sandbox
     * window being the usual reason — needs a way to ask again without paying
     * again, and this is the only screen they are holding.
     */
    fulfilled: { on: { RESEND: "resending" } },
    pending: { on: { RESEND: "resending" } },

    // Owning the book is the most serviceable outcome there is: the order and the
    // grant already exist, so the links can just be sent again.
    owned: { on: { RESEND: "resending" } },

    // Only a genuine refusal — an identity we cannot resolve — is a dead end,
    // because there is nothing to send.
    refused: {},
    failed: { on: { RESEND: "resending" } },

    resending: {
      invoke: {
        src: "resendActor",
        onDone: { target: "resent", actions: "assignResend" },
        onError: { target: "resent", actions: "assignResendFailed" },
      },
    },

    resent: { on: { RESEND: "resending" } },
  },
} as const;
