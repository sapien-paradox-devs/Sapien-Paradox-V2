/** Composition. The screen imports this, never `machine.ts`. */

import { assign, setup } from "xstate";

import * as actions from "./actions";
import * as actors from "./actors";
import { readersConfig } from "./machine";
import type { Context, Event } from "./types";

export const readersMachine = setup({
  types: {} as { context: Context; events: Event },
  actions: {
    assignSearch: assign(actions.searchFrom),
    assignStatus: assign(actions.statusFrom),
    assignReaders: assign(actions.readersFrom),
  },
  actors: { fetchReaders: actors.fetchReaders },
  // Long enough that a name typed at speed is one request, short enough to feel live.
  delays: { searchPause: 300 },
}).createMachine(readersConfig);
