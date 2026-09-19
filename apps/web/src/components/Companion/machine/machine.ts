/**
 * The companion — level 2.
 *
 * It earns a machine because it opens, asks and caps out on its own timeline,
 * independent of the page it sits in (D15).
 *
 * **It starts closed and stays silent until the reader opens it (D14).** The
 * companion never interrupts — that is the rule the whole chamber is designed
 * around, and it is why there is no notification, no badge and no auto-open.
 */

import type { Context } from "./types";

export const companionConfig = {
  id: "companion",
  initial: "closed",
  context: { token: "", exchanges: [], pending: "" } as Context,

  states: {
    closed: { on: { OPEN: { target: "idle" } } },

    idle: {
      on: {
        ASK: { target: "asking", actions: "rememberQuestion" },
        CLOSE: { target: "closed" },
      },
    },

    asking: {
      invoke: {
        src: "askCompanion",
        input: ({ context }: { context: Context }) => ({
          token: context.token,
          question: context.pending,
        }),
        onDone: { target: "idle", actions: "recordAnswer" },
        onError: [
          // A boundary, not a failure. Terminal for this chapter.
          { guard: "isCapped", target: "capped" },
          { target: "error" },
        ],
      },
    },

    // The question is still in context, so a retry does not lose what was typed.
    error: {
      on: {
        RETRY: { target: "asking" },
        CLOSE: { target: "closed" },
      },
    },

    capped: { on: { CLOSE: { target: "closed" } } },
  },
} as const;
