/** Composition. The component imports this, never `machine.ts`. */

import { assign, setup } from "xstate";

import * as actions from "./actions";
import * as actors from "./actors";
import { pdfConfig } from "./machine";
import type { Context, Event } from "./types";

export const pdfMachine = setup({
  types: {} as { context: Context; events: Event; input: { token: string } },
  actions: { assignUrl: assign(actions.urlFrom) },
  actors: { loadPdf: actors.loadPdf },
}).createMachine({
  ...pdfConfig,
  context: ({ input }: { input: { token: string } }) => ({
    token: input.token,
    objectUrl: null,
  }),
});

export type { Context, Event } from "./types";
