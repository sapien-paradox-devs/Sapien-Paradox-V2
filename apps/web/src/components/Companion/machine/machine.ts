/**
 * The companion — level 2 (D15, D88).
 *
 * It earns a machine because it opens, asks and caps out on its own timeline,
 * independent of the page it sits in.
 *
 * **It starts closed and stays silent until the reader opens it (D14).** On the
 * first open the companion speaks first, with a question about the chapter
 * (D13); later opens return to the conversation as it was.
 *
 *   closed ──OPEN──▶ opening (the companion's first question) ──▶ idle
 *                          └──▶ idle, if there is already a conversation
 *   idle ──ASK──▶ asking ──▶ idle
 *   opening / asking fail ──▶ error (RETRY) · paused (the cap, unavailable, not ready)
 */

import type { Context } from "./types";

export const companionConfig = {
  id: "companion",
  initial: "closed",
  context: { token: "", turns: [], pending: "", pause: null } as Context,

  on: { CLOSE: { target: ".closed" } },

  states: {
    closed: {
      on: {
        OPEN: [
          { guard: "hasConversation", target: "idle" },
          { target: "opening" },
        ],
      },
    },

    opening: {
      invoke: {
        src: "openCompanion",
        input: ({ context }: { context: Context }) => ({ token: context.token }),
        onDone: { target: "idle", actions: "addCompanionTurn" },
        onError: [
          { guard: "isPause", target: "paused", actions: "assignPause" },
          { target: "openingFailed" },
        ],
      },
    },
    openingFailed: { on: { RETRY: { target: "opening" } } },

    idle: {
      on: { ASK: { guard: "hasText", target: "asking", actions: ["addReaderTurn", "rememberPending"] } },
    },

    asking: {
      invoke: {
        src: "askCompanion",
        // The thread before this message: the reader's new turn is the question.
        input: ({ context }: { context: Context }) => ({
          token: context.token,
          question: context.pending,
          history: context.turns.slice(0, -1),
        }),
        onDone: { target: "idle", actions: ["addCompanionTurn", "clearPending"] },
        onError: [
          { guard: "isPause", target: "paused", actions: "assignPause" },
          { target: "askFailed" },
        ],
      },
    },
    // The reader's turn stays on screen; a retry sends it again unchanged.
    askFailed: { on: { RETRY: { target: "asking" } } },

    // A boundary, not a failure: said plainly, and the conversation stays readable.
    paused: {
      on: {
        // Too long is the one pause the reader can fix: they may try again.
        ASK: { guard: "canAskAgain", target: "asking", actions: ["dropUnsentTurn", "addReaderTurn", "rememberPending", "clearPause"] },
      },
    },
  },
} as const;
