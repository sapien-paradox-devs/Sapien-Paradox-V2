/** Composition. The page imports this, never `machine.ts`. */

import { assign, setup } from "xstate";

import * as actions from "./actions";
import * as actors from "./actors";
import * as guards from "./guards";
import { beginConfig } from "./machine";
import type { Context, Event } from "./types";

export const beginMachine = setup({
  types: {} as { context: Context; events: Event },
  actions: {
    assignBooks: assign(actions.booksFrom),
    assignOrderDetails: assign(actions.orderDetailsFrom),
    assignSignup: assign(actions.signupFrom),
    navigateToWelcome: actions.navigateToWelcome,
  },
  actors: {
    fetchBooks: actors.fetchBooks,
    startCheckout: actors.startCheckout,
    payAndConfirm: actors.payAndConfirm,
  },
  guards: { isDismissed: guards.isDismissed },
}).createMachine(beginConfig);

export type { Book, Context, Event, Signup } from "./types";
