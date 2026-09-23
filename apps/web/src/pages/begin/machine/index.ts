/** Composition. The page imports this, never `machine.ts`. */

import { assign, setup } from "xstate";

import * as actions from "./actions";
import * as actors from "./actors";
import { beginConfig } from "./machine";
import type { Context, Event } from "./types";

export const beginMachine = setup({
  types: {} as { context: Context; events: Event },
  actions: {
    assignBooks: assign(actions.booksFrom),
    assignPaymentUrl: assign(actions.paymentUrlFrom),
    leaveForPayment: actions.leaveForPayment,
  },
  actors: { fetchBooks: actors.fetchBooks, startCheckout: actors.startCheckout },
}).createMachine(beginConfig);

export type { Book, Context, Event, Signup } from "./types";
