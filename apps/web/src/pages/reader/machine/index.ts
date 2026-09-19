/** Composition. The page imports this, never `machine.ts`. */

import { assign, setup } from "xstate";

import * as actions from "./actions";
import * as actors from "./actors";
import * as guards from "./guards";
import { readerConfig } from "./machine";
import type { Context, Event } from "./types";

export const readerMachine = setup({
  types: {} as { context: Context; events: Event; input: { token: string } },
  actions: { assignChapter: assign(actions.chapterFrom) },
  actors: { fetchGrant: actors.fetchGrant, reissueGrant: actors.reissueGrant },
  guards: {
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
