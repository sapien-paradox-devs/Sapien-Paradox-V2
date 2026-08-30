/**
 * Opening — level 1. The invisible page behind `/read/:chapterId`.
 *
 * It swaps a chapter for a token and redirects; the reader never sees it settle.
 *
 * **It starts in `waiting`, not `resolving` (D44).** On a hard refresh the root
 * machine's session region is still `checking`, and treating "not yet
 * authenticated" as "anonymous" bounces a signed-in reader to `/login` — a bug
 * that appears only on reload, only for signed-in readers, and never in
 * development, where the session check resolves instantly.
 */

import type { Context } from "./types";

export const openingConfig = {
  id: "opening",
  initial: "waiting",
  context: ({ input }: { input: { chapterId: string } }) => ({
    chapterId: input.chapterId,
    token: null,
  }) as Context,

  states: {
    waiting: {
      on: {
        SESSION_SETTLED: [
          { guard: "isAuthenticated", target: "resolving" },
          { target: "anonymous" },
        ],
      },
    },

    resolving: {
      invoke: {
        src: "resolveChapter",
        input: ({ context }: { context: Context }) => ({
          chapterId: context.chapterId,
        }),
        onDone: { target: "resolved", actions: "assignToken" },
        onError: [
          // You do not own this book. No button helps, so it is not sanctuary.
          { guard: "isForbidden", target: "denied" },
          { target: "error" },
        ],
      },
    },

    // The page redirects out of these two; neither renders for long.
    resolved: { type: "final" },
    anonymous: { type: "final" },

    denied: {},
    error: { on: { RETRY: { target: "resolving" } } },
  },
} as const;
