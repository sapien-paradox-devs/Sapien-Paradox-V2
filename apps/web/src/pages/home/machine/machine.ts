/**
 * Home — level 1. Two parallel regions (D42).
 *
 *   list  loading → ready · empty · error
 *   send  idle → sending → sent · limited · failed
 *
 * They are parallel so the chapter list stays readable while a "send this to my
 * WhatsApp" request is in flight. One sequence of states would have to leave
 * `ready` to represent sending, blanking the list for one button press.
 */

import type { Context, Event } from "./types";

// Hoisted and annotated: inside an `as const` object, `books: []` would freeze
// to `readonly []`, which the machine's Context rejects. The `as const` itself
// is needed so `type: "parallel"` stays a literal rather than widening to string.
const initialContext: Context = { books: [], sendingChapterId: null };

export const homeConfig = {
  id: "home",
  type: "parallel",
  context: initialContext,

  states: {
    list: {
      initial: "loading",
      states: {
        loading: {
          invoke: {
            src: "fetchHome",
            onDone: [
              { guard: "hasChapters", target: "ready", actions: "assignBooks" },
              { target: "empty" },
            ],
            onError: { target: "error" },
          },
        },
        ready: {},
        // Said plainly, so an empty frame does not read as a failure.
        empty: {},
        error: { on: { RETRY: { target: "loading" } } },
      },
    },

    send: {
      initial: "idle",
      states: {
        idle: {
          on: { SEND: { target: "sending", actions: "markSending" } },
        },
        sending: {
          invoke: {
            src: "sendChapter",
            input: ({ event }: { event: Event }) => ({
              chapterId: event.type === "SEND" ? event.chapterId : "",
            }),
            onDone: { target: "sent" },
            onError: [
              // Already sent. An outcome, not a failure (D45).
              { guard: "isRateLimited", target: "limited" },
              { target: "failed" },
            ],
          },
        },
        sent: { on: { DISMISS: { target: "idle", actions: "clearSending" } } },
        limited: { on: { DISMISS: { target: "idle", actions: "clearSending" } } },
        failed: {
          on: {
            DISMISS: { target: "idle", actions: "clearSending" },
            SEND: { target: "sending", actions: "markSending" },
          },
        },
      },
    },
  },
} as const;
