/** Composition. The screen imports this, never `machine.ts`. */

import { assign, setup } from "xstate";

import * as actions from "./actions";
import * as actors from "./actors";
import * as guards from "./guards";
import { bookConfig } from "./machine";
import type { Context, Event } from "./types";

export const bookMachine = setup({
  types: {} as { context: Context; events: Event; input: { id: string } },
  actions: {
    assignBook: assign(actions.bookFrom),
    assignOp: assign(actions.opFrom),
    clearOp: assign(actions.clearOp),
    assignOpRefusal: assign(actions.opRefusal),
    clearRefusal: assign(actions.clearRefusal),
  },
  actors: { fetchBook: actors.fetchBook, runOp: actors.runOp },
  guards: { hasBook: guards.hasBook },
}).createMachine({
  ...bookConfig,
  context: ({ input }: { input: { id: string } }) => ({ id: input.id, book: null, refusal: null, op: null }),
});

export type { Details, Op } from "./types";
