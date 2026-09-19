/**
 * The chamber — level 1. The only page reachable without a session, and the one
 * the whole product exists to deliver.
 *
 * Two parallel regions (D42): `chamber` holds what is on screen, `reissue`
 * holds a re-issue request in flight, so asking for a fresh link does not blank
 * the sanctuary screen.
 *
 * `sanctuary` means an expired or invalid link and nothing else. The end of a
 * chapter is `finished` — V1 used one word for both.
 */

import type { Context } from "./types";

const initialContext: Context = { token: "", chapter: null };

export const readerConfig = {
  id: "reader",
  type: "parallel",
  context: initialContext,

  states: {
    chamber: {
      initial: "loading",
      states: {
        loading: {
          invoke: {
            src: "fetchGrant",
            input: ({ context }: { context: Context }) => ({ token: context.token }),
            onDone: { target: "reading", actions: "assignChapter" },
            onError: [
              { guard: "isExpired", target: "sanctuary" },
              // No button solves this one, so it must not offer sanctuary's.
              { guard: "isForbidden", target: "denied" },
              { target: "error" },
            ],
          },
        },
        reading: { on: { FINISH: { target: "finished" } } },
        // Rendered minimally. No celebration — it is the anchor D14's deferred
        // end-of-chapter question attaches to.
        finished: {},
        sanctuary: {},
        denied: {},
        error: { on: { RETRY: { target: "loading" } } },
      },
    },

    reissue: {
      initial: "idle",
      states: {
        idle: { on: { REISSUE: { target: "sending" } } },
        sending: {
          invoke: {
            src: "reissueGrant",
            input: ({ context }: { context: Context }) => ({ token: context.token }),
            onDone: { target: "sent" },
            onError: [
              { guard: "isRateLimited", target: "limited" },
              { target: "failed" },
            ],
          },
        },
        sent: {},
        limited: {},
        failed: { on: { REISSUE: { target: "sending" } } },
      },
    },
  },
} as const;
