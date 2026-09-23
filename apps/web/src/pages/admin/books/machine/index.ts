/** Composition. The screen imports this, never `machine.ts`. */

import { assign, setup } from "xstate";

import * as actions from "./actions";
import * as actors from "./actors";
import { booksConfig } from "./machine";
import type { Context, Event } from "./types";

export const booksMachine = setup({
  types: {} as { context: Context; events: Event },
  actions: { assignBooks: assign(actions.booksFrom) },
  actors: { fetchBooks: actors.fetchBooks },
}).createMachine(booksConfig);
