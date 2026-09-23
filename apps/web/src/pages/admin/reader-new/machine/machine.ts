/**
 * Admin · Add a reader — level 1 (D82).
 *
 *   loadingBooks → editing ──SUBMIT──▶ saving → done
 *                                          ├─ 409 → editing, with the refusal on its field
 *                                          └─ other → failed
 *
 * The API dispatches this through the acquisition machine, so the four
 * identity cases of D26 decide the outcome; this machine only shows it.
 */

import type { Context, Event } from "./types";

const initialContext: Context = { books: [], refusal: null, created: null, delivered: false };

export const newReaderConfig = {
  id: "adminNewReader",
  initial: "loadingBooks",
  context: initialContext,

  states: {
    loadingBooks: {
      invoke: {
        src: "fetchBooks",
        onDone: { target: "editing", actions: "assignBooks" },
        onError: { target: "booksFailed" },
      },
    },
    booksFailed: { on: { RETRY: { target: "loadingBooks" } } },

    editing: {
      on: {
        SUBMIT: { guard: "isComplete", target: "saving", actions: "clearRefusal" },
        EDIT: { actions: "clearRefusal" },
      },
    },

    saving: {
      invoke: {
        src: "createReader",
        input: ({ event }: { event: Event }) =>
          event.type === "SUBMIT" ? event.reader : null,
        onDone: { target: "done", actions: "assignCreated" },
        onError: [
          { guard: "isRefusal", target: "editing", actions: "assignRefusal" },
          { target: "failed" },
        ],
      },
    },

    failed: {
      on: {
        SUBMIT: { guard: "isComplete", target: "saving" },
        EDIT: { target: "editing" },
      },
    },

    // The screen watches for this and opens the new reader's page.
    done: { type: "final" },
  },
} as const;
