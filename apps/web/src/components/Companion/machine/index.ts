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
    addReaderTurn: assign(actions.addReaderTurn),
    addCompanionTurn: assign(actions.addCompanionTurn),
    rememberPending: assign(actions.rememberPending),
    clearPending: assign(actions.clearPending),
    assignPause: assign(actions.assignPause),
    clearPause: assign(actions.clearPause),
    dropUnsentTurn: assign(actions.dropUnsentTurn),
  },
  actors: { openCompanion: actors.openCompanion, askCompanion: actors.askCompanion },
  guards: {
    hasConversation: guards.hasConversation,
    hasText: guards.hasText,
    isPause: guards.isPause,
    canAskAgain: guards.canAskAgain,
  },
}).createMachine({
  ...companionConfig,
  context: ({ input }: { input: { token: string } }) => ({
    token: input.token,
    turns: [],
    pending: "",
    pause: null,
  }),
});

export type { Context, Event, Pause, Turn } from "./types";
