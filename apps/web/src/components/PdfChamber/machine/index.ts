/** Composition. The component imports this, never `machine.ts`. */

import { assign, setup } from "xstate";

import * as actions from "./actions";
import * as actors from "./actors";
import { pdfConfig } from "./machine";
import type { Context, Event } from "./types";

export const pdfMachine = setup({
  types: {} as { context: Context; events: Event; input: { token: string } },
  actions: { assignLayout: assign(actions.layoutFrom) },
  actors: { loadLayout: actors.loadLayout },
}).createMachine({
  ...pdfConfig,
  context: ({ input }: { input: { token: string } }) => ({
    token: input.token,
    layout: null,
  }),
});

export type { Context, Event, Layout, PageSize } from "./types";
