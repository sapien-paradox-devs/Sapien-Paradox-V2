/** Composition. The screen imports this, never `machine.ts`. */

import { assign, enqueueActions, setup } from "xstate";

import * as actions from "./actions";
import * as actors from "./actors";
import * as guards from "./guards";
import { bookConfig } from "./machine";
import type { Context, Event } from "./types";

export const bookMachine = setup({
  types: {} as { context: Context; events: Event; input: { id: string } },
  actions: {
    assignBook: assign(actions.bookFrom),
    assignBookFromUpload: assign(actions.bookFromUpload),
    assignOp: assign(actions.opFrom),
    clearOp: assign(actions.clearOp),
    assignOpRefusal: assign(actions.opRefusal),
    clearRefusal: assign(actions.clearRefusal),

    stagePdfs: assign(actions.stagePdfs),
    retitleStaged: assign(actions.retitleStaged),
    moveStaged: assign(actions.moveStaged),
    unstage: assign(actions.unstage),
    enqueueStagedPdfs: assign(actions.enqueueStagedPdfs),
    cancelPdfs: assign(actions.cancelPdfs),

    enqueueOne: assign(actions.enqueueOne),
    requeue: assign(actions.requeue),
    clearFinished: assign(actions.clearFinished),
    markProgress: assign(actions.progress),
    markFinishing: assign(actions.finishing),
    markDone: assign(actions.done),
    markFailed: assign(actions.failed),

    /** Start what may start, one child actor per file, named by its id. */
    pump: enqueueActions(({ context, enqueue }) => {
      const start = actions.startable(context.uploads);
      if (start.length === 0) return;
      const ids = new Set(start.map((u) => u.id));
      enqueue.assign({ uploads: actions.markSending(context.uploads, ids) });
      for (const u of start) {
        enqueue.spawnChild("uploadFile", {
          id: u.id,
          input: { id: u.id, bookId: context.id, file: u.file, target: u.target, title: u.title },
        });
      }
    }),
  },
  actors: { fetchBook: actors.fetchBook, runOp: actors.runOp, uploadFile: actors.uploadFile },
  guards: {
    hasBook: guards.hasBook,
    hasStagedPdfs: guards.hasStagedPdfs,
  },
}).createMachine({
  ...bookConfig,
  context: ({ input }: { input: { id: string } }) => ({
    id: input.id,
    book: null,
    refusal: null,
    op: null,
    stagedPdfs: null,
    uploads: [],
    nextUploadId: 1,
  }),
});

export type { Details, Op, Target, UploadItem } from "./types";
