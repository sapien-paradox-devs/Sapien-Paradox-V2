/** Composition. Components import this, never `machine.ts`. */

import { assign, setup } from "xstate";

import * as actions from "./actions";
import * as actors from "./actors";
import * as guards from "./guards";
import { navigationConfig } from "./machine";
import type { Context, Event } from "./types";

export const navigationMachine = setup({
  types: {} as { context: Context; events: Event },
  actions: {
    assignUser: assign(actions.userFrom),
    assignCheckedUser: assign(actions.userFromCheck),
    clearUser: assign(actions.noUser),
    pushUrl: actions.pushUrl,
    goToHome: actions.goToHome,
    goToLogin: actions.goToLogin,
  },
  actors: {
    checkSession: actors.checkSession,
    logoutActor: actors.logoutActor,
  },
  guards: {
    isReaderPath: guards.isReaderPath,
    isLoginPath: guards.isLoginPath,
    isResetPath: guards.isResetPath,
    isOpeningPath: guards.isOpeningPath,
    isWelcomePath: guards.isWelcomePath,
  },
}).createMachine(navigationConfig);

export type { Context, Event, User } from "./types";
