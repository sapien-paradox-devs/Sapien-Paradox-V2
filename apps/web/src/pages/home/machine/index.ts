/** Composition. The page imports this, never `machine.ts`. */

import { assign, setup } from "xstate";

import * as actions from "./actions";
import * as actors from "./actors";
import * as guards from "./guards";
import { homeConfig } from "./machine";
import type { Context, Event } from "./types";

export const homeMachine = setup({
  types: {} as { context: Context; events: Event },
  actions: {
    assignBooks: assign(actions.booksFrom),
    markSending: assign(actions.markSending),
    clearSending: assign(actions.clearSending),
  },
  actors: { fetchHome: actors.fetchHome, sendChapter: actors.sendChapter },
  guards: { hasChapters: guards.hasChapters, isRateLimited: guards.isRateLimited },
}).createMachine(homeConfig);

export type { Book, Chapter, Context, Event } from "./types";
