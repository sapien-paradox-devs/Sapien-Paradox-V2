/** Composition. The page imports this, never `machine.ts`. */

import { assign, setup } from "xstate";

import * as actions from "./actions";
import { confirmActor, resendActor } from "./actors";
import * as guards from "./guards";
import { welcomeConfig } from "./machine";
import type { Context, Event } from "./types";

export const welcomeMachine = setup({
  types: {} as { context: Context; events: Event },
  actions: {
    assignOutcome: assign(actions.outcomeFrom),
    assignResend: assign(actions.resendOutcomeFrom),
    assignResendFailed: assign(actions.resendFailed),
  },
  actors: { confirmActor, resendActor },
  guards: { isFulfilled: guards.isFulfilled, isPending: guards.isPending },
}).createMachine(welcomeConfig);

export type { Context, Event, Outcome, ResendOutcome } from "./types";
