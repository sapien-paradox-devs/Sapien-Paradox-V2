/** Composition. The page imports this, never `machine.ts`. */

import { assign, setup } from "xstate";

import * as actions from "./actions";
import * as actors from "./actors";
import * as guards from "./guards";
import { profileConfig } from "./machine";
import type { Context, Event } from "./types";

export const profileMachine = setup({
  types: {} as { context: Context; events: Event },
  actions: {
    assignProfile: assign(actions.profileFrom),
    assignEmailTakenError: assign(actions.emailTakenError),
    assignSaveError: assign(actions.saveError),
    clearSaveError: assign(actions.clearSaveError),
    assignWrongPasswordError: assign(actions.wrongPasswordError),
    assignTooShortError: assign(actions.tooShortError),
    assignPasswordError: assign(actions.passwordError),
    clearPasswordError: assign(actions.clearPasswordError),
  },
  actors: {
    fetchProfile: actors.fetchProfile,
    saveProfile: actors.saveProfile,
    changePassword: actors.changePassword,
  },
  guards: {
    isEmailTaken: guards.isEmailTaken,
    isWrongPassword: guards.isWrongPassword,
    isTooShort: guards.isTooShort,
  },
}).createMachine(profileConfig);

export type { BookProgress, Context, Event, Profile } from "./types";
