/** Composition. The page imports this, never `machine.ts`. */

import { assign, setup } from "xstate";

import * as actions from "./actions";
import * as actors from "./actors";
import { landingConfig } from "./machine";
import type { Context, Event } from "./types";

export const landingMachine = setup({
  types: {} as { context: Context; events: Event },
  actions: {
    assignBooks: assign(actions.booksFrom),
    assignPaymentUrl: assign(actions.paymentUrlFrom),
    leaveForPayment: actions.leaveForPayment,
  },
  actors: { fetchBooks: actors.fetchBooks, startCheckout: actors.startCheckout },
}).createMachine(landingConfig);

export type { Book, Context, Event, Signup } from "./types";
