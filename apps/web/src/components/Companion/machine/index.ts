/** Composition. The component imports this, never `machine.ts`. */

import { assign, setup } from "xstate";

import * as actions from "./actions";
import * as actors from "./actors";
import * as guards from "./guards";
import { companionConfig } from "./machine";
import type { Context, Event } from "./types";

export const companionMachine = setup({
  types: {} as { context: Context; events: Event; input: { token: string } },
  actions: {
    rememberQuestion: assign(actions.rememberQuestion),
    recordAnswer: assign(actions.recordAnswer),
  },
  actors: { askCompanion: actors.askCompanion },
  guards: { isCapped: guards.isCapped },
}).createMachine({
  ...companionConfig,
  context: ({ input }: { input: { token: string } }) => ({
    token: input.token,
    exchanges: [],
    pending: "",
  }),
});

export type { Context, Event, Exchange } from "./types";
