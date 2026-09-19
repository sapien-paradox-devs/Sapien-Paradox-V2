/** Composition. The page imports this, never `machine.ts`. */

import { assign, setup } from "xstate";

import * as actions from "./actions";
import * as actors from "./actors";
import * as guards from "./guards";
import { resetConfig } from "./machine";
import type { Context, Event, ResetInput } from "./types";

export const resetMachine = setup({
  types: {} as { context: Context; events: Event; input: ResetInput },
  actions: {
    clearError: assign(actions.clearError),
    showTooShort: assign(actions.showTooShort),
    showMismatch: assign(actions.showMismatch),
    showUnexpected: assign(actions.showUnexpected),
    showLinkDead: assign(actions.showLinkDead),
  },
  actors: { confirmActor: actors.confirmActor },
  guards: {
    // Expressed as the failing case so the transition list reads as a series of
    // refusals ending in the success path.
    passwordTooShort: (args) => !guards.passwordLongEnough(args),
    passwordsDiffer: (args) => !guards.passwordsMatch(args),
    isLinkDead: guards.isLinkDead,
    isTooShort: guards.isTooShort,
  },
}).createMachine(resetConfig);

export type { Context, Event, ResetInput } from "./types";
