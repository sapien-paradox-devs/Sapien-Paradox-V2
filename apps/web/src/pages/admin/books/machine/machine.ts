/** Admin · Books — level 1 (D82). `loading → ready · error`. */

import type { Context } from "./types";

const initialContext: Context = { books: [] };

export const booksConfig = {
  id: "adminBooks",
  initial: "loading",
  context: initialContext,
  states: {
    loading: {
      invoke: {
        src: "fetchBooks",
        onDone: { target: "ready", actions: "assignBooks" },
        onError: { target: "error" },
      },
    },
    ready: {},
    error: { on: { RETRY: { target: "loading" } } },
  },
} as const;
