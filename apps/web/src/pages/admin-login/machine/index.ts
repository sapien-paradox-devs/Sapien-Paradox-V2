/** Composition. The page imports this, never `machine.ts`. */

import { assign, setup } from "xstate";

import * as actions from "./actions";
import * as actors from "./actors";
import * as guards from "./guards";
import { adminLoginConfig } from "./machine";
import type { Context, Event } from "./types";

export const adminLoginMachine = setup({
  types: {} as { context: Context; events: Event },
  actions: {
    assignUser: assign(actions.userFromLogin),
    clearError: assign(actions.clearError),
    showInvalid: assign(actions.invalidCredentials),
    showUnexpected: assign(actions.unexpectedFailure),
  },
  actors: { loginActor: actors.loginActor },
  guards: {
    fieldsPresent: guards.fieldsPresent,
    isStaffUser: guards.isStaffUser,
    isUnauthorized: guards.isUnauthorized,
  },
}).createMachine(adminLoginConfig);
