/** Composition. The page imports this, never `machine.ts`. */

import { assign, setup } from "xstate";

import * as actions from "./actions";
import * as actors from "./actors";
import * as guards from "./guards";
import { openingConfig } from "./machine";
import type { Context, Event } from "./types";

export const openingMachine = setup({
  types: {} as {
    context: Context;
    events: Event;
    input: { chapterId: string };
  },
  actions: { assignToken: assign(actions.tokenFrom) },
  actors: { resolveChapter: actors.resolveChapter },
  guards: { isAuthenticated: guards.isAuthenticated, isForbidden: guards.isForbidden },
}).createMachine(openingConfig);

export type { Context, Event } from "./types";
