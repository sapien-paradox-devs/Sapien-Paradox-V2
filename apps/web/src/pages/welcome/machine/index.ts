/** Composition. The page imports this, never `machine.ts`. */

import { assign, setup } from "xstate";

import * as actions from "./actions";
import { confirmActor } from "./actors";
import * as guards from "./guards";
import { welcomeConfig } from "./machine";
import type { Context, Event } from "./types";

export const welcomeMachine = setup({
  types: {} as { context: Context; events: Event },
  actions: { assignOutcome: assign(actions.outcomeFrom) },
  actors: { confirmActor },
  guards: { isFulfilled: guards.isFulfilled, isPending: guards.isPending },
}).createMachine(welcomeConfig);

export type { Context, Event, Outcome } from "./types";
