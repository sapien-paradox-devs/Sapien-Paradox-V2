/** Composition. The screen imports this, never `machine.ts`. */

import { assign, setup } from "xstate";

import * as actions from "./actions";
import * as actors from "./actors";
import * as guards from "./guards";
import { readerConfig } from "./machine";
import type { Context, Event } from "./types";

export const readerMachine = setup({
  types: {} as { context: Context; events: Event; input: { id: string } },
  actions: {
    assignReader: assign(actions.readerFrom),
    assignRefusal: assign(actions.refusalFrom),
    assignFailure: assign(actions.failure),
    clearRefusal: assign(actions.clearRefusal),
    assignAction: assign(actions.actionFrom),
    clearAction: assign(actions.clearAction),
  },
  actors: {
    fetchReader: actors.fetchReader,
    updateReader: actors.updateReader,
    runAction: actors.runAction,
  },
  guards: {
    isEditable: guards.isEditable,
    isAllowed: guards.isAllowed,
    isErase: guards.isErase,
    isRestore: guards.isRestore,
    isRefusal: guards.isRefusal,
  },
}).createMachine({
  ...readerConfig,
  context: ({ input }: { input: { id: string } }) => ({
    id: input.id,
    reader: null,
    refusal: null,
    action: null,
  }),
});

export type { Action, Details } from "./types";
