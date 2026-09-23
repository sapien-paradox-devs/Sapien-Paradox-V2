/**
 * Admin · Readers — level 1 (D82). The list, its search and its filter.
 *
 *   loading → ready · error
 *   ready ──SEARCH──▶ typing ──(pause)──▶ loading
 *
 * Typing does not fetch on every key: `typing` waits for a short pause (the
 * `searchPause` delay), and each further key restarts the wait. The filter
 * fetches at once. The list stays on screen while the next one loads.
 */

import type { Context } from "./types";

const initialContext: Context = { readers: [], search: "", status: "all" };

export const readersConfig = {
  id: "adminReaders",
  initial: "loading",
  context: initialContext,

  on: {
    SEARCH: { target: ".typing", actions: "assignSearch" },
    STATUS: { target: ".loading", actions: "assignStatus" },
  },

  states: {
    typing: { after: { searchPause: { target: "loading" } } },
    loading: {
      invoke: {
        src: "fetchReaders",
        input: ({ context }: { context: Context }) => ({
          search: context.search,
          status: context.status,
        }),
        onDone: { target: "ready", actions: "assignReaders" },
        onError: { target: "error" },
      },
    },
    ready: {},
    error: { on: { RETRY: { target: "loading" } } },
  },
} as const;
