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
 *
 * `threshold` is the ceremony on the first open of a link (#116): four beats,
 * each a state, so the sequence is data rather than a chain of timers
 * (mandate 2, D54). The chamber renders underneath from the first beat, so the
 * PDF loads while the ceremony plays.
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
            onDone: [
              { guard: "isFirstOpen", target: "threshold", actions: "assignChapter" },
              // Coming back to a chapter already marked complete (D70).
              { guard: "isCompleted", target: "finished", actions: "assignChapter" },
              { target: "reading", actions: "assignChapter" },
            ],
            onError: [
              { guard: "isExpired", target: "sanctuary" },
              // No button solves this one, so it must not offer sanctuary's.
              { guard: "isForbidden", target: "denied" },
              { target: "error" },
            ],
          },
        },
        threshold: {
          initial: "gathering",
          on: { SKIP: { target: "reading" } },
          states: {
            // the book's name and the chapter numeral
            gathering: { after: { beat: { target: "titled" } } },
            // the chapter's title
            titled: { after: { beat: { target: "ruled" } } },
            // a hairline draws under it
            ruled: { after: { beat: { target: "lifting" } } },
            // the whole card lifts away, revealing the chamber
            lifting: { after: { beat: { target: "#reader.chamber.reading" } } },
          },
        },
        reading: { on: { FINISH: { target: "completing" } } },
        // Marking complete is saved before it is shown: 100% on Home must be
        // true, not hoped for (D70).
        completing: {
          invoke: {
            src: "completeChapter",
            input: ({ context }: { context: Context }) => ({ token: context.token }),
            onDone: { target: "finished" },
            onError: { target: "completeFailed" },
          },
        },
        completeFailed: { on: { FINISH: { target: "completing" } } },
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
