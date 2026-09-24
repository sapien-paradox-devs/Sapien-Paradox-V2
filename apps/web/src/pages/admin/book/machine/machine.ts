/**
 * Admin · The book workspace — level 1 (D84). Two parallel regions (D42):
 *
 *   data  loading → ready · error
 *   ops   idle ──RUN──▶ working → idle            (one change at a time)
 *
 * Every change returns the whole book, so the screen always redraws from the
 * server's truth. Uploads join as a third region in #183.
 */

import type { Context } from "./types";

const initialContext: Context = { id: "", book: null, refusal: null, op: null };

export const bookConfig = {
  id: "adminBook",
  type: "parallel",
  context: initialContext,

  on: {
    DISMISS_REFUSAL: { actions: "clearRefusal" },
  },

  states: {
    data: {
      initial: "loading",
      states: {
        loading: {
          invoke: {
            src: "fetchBook",
            input: ({ context }: { context: Context }) => ({ id: context.id }),
            onDone: { target: "ready", actions: "assignBook" },
            onError: { target: "error" },
          },
        },
        ready: {},
        error: { on: { RETRY: { target: "loading" } } },
      },
    },

    ops: {
      initial: "idle",
      states: {
        idle: {
          on: { RUN: { guard: "hasBook", target: "working", actions: ["assignOp", "clearRefusal"] } },
        },
        working: {
          invoke: {
            src: "runOp",
            input: ({ context }: { context: Context }) => ({ id: context.id, op: context.op }),
            onDone: { target: "idle", actions: ["assignBook", "clearOp"] },
            onError: { target: "idle", actions: ["assignOpRefusal", "clearOp"] },
          },
        },
      },
    },
  },
} as const;
