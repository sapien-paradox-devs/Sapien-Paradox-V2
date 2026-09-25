/** Composition. The screen imports this, never `machine.ts`. */

import { assign, setup } from "xstate";

import * as actions from "./actions";
import * as actors from "./actors";
import * as guards from "./guards";
import { newBookConfig } from "./machine";
import type { Context, Event } from "./types";

export const newBookMachine = setup({
  types: {} as { context: Context; events: Event },
  actions: {
    assignCreated: assign(actions.createdFrom),
    assignRefusal: assign(actions.refusalFrom),
    clearRefusal: assign(actions.clearRefusal),
  },
  actors: { createBook: actors.createBook },
  guards: { hasTitle: guards.hasTitle },
}).createMachine(newBookConfig);

export type { NewBook } from "./types";
