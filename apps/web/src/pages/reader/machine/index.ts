/** Composition. The page imports this, never `machine.ts`. */

import { assign, setup } from "xstate";

import { ceremonyBeat } from "../../../lib/motion";
import * as actions from "./actions";
import * as actors from "./actors";
import * as guards from "./guards";
import { readerConfig } from "./machine";
import type { Context, Event } from "./types";

export const readerMachine = setup({
  types: {} as { context: Context; events: Event; input: { token: string } },
  actions: { assignChapter: assign(actions.chapterFrom) },
  actors: {
    fetchGrant: actors.fetchGrant,
    reissueGrant: actors.reissueGrant,
    completeChapter: actors.completeChapter,
  },
  // One beat of the threshold ceremony, read from the `--dur-ceremony` CSS
  // token so reduced motion shortens it in the one place it is defined.
  delays: { beat: ceremonyBeat },
  guards: {
    isFirstOpen: guards.isFirstOpen,
    isCompleted: guards.isCompleted,
    isExpired: guards.isExpired,
    isForbidden: guards.isForbidden,
    isRateLimited: guards.isRateLimited,
  },
}).createMachine({
  ...readerConfig,
  context: ({ input }: { input: { token: string } }) => ({
    token: input.token,
    chapter: null,
  }),
});

export type { ChapterMeta, Context, Event } from "./types";
