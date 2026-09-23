/** Composition. The screen imports this, never `machine.ts`. */

import { assign, setup } from "xstate";

import * as actions from "./actions";
import * as actors from "./actors";
import * as guards from "./guards";
import { newReaderConfig } from "./machine";
import type { Context, Event } from "./types";

export const newReaderMachine = setup({
  types: {} as { context: Context; events: Event },
  actions: {
    assignBooks: assign(actions.booksFrom),
    assignCreated: assign(actions.createdFrom),
    assignRefusal: assign(actions.refusalFrom),
    clearRefusal: assign(actions.clearRefusal),
  },
  actors: { fetchBooks: actors.fetchBooks, createReader: actors.createReader },
  guards: { isComplete: guards.isComplete, isRefusal: guards.isRefusal },
}).createMachine(newReaderConfig);

export type { NewReader } from "./types";
