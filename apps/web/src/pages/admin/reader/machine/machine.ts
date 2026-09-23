/**
 * Admin · One reader — level 1 (D82). Three parallel regions (D42):
 *
 *   data    loading → ready · error
 *   edit    viewing ──EDIT──▶ editing ──SAVE──▶ saving → viewing (saved)
 *                                                  └─ 409 → editing, refusal on its field
 *   action  idle ──ASK──▶ confirming ──CONFIRM──▶ working → idle
 *                        (erase asks twice: confirming → confirmingAgain;
 *                         restore asks nothing and goes straight to working)
 *
 * Parallel so an edit or an action never blanks the reader's page, and so the
 * irreversible erase always passes through two explicit confirmations (D80).
 */

import type { Context, Event } from "./types";

const initialContext: Context = { id: "", reader: null, refusal: null, action: null };

export const readerConfig = {
  id: "adminReader",
  type: "parallel",
  context: initialContext,

  states: {
    data: {
      initial: "loading",
      states: {
        loading: {
          invoke: {
            src: "fetchReader",
            input: ({ context }: { context: Context }) => ({ id: context.id }),
            onDone: { target: "ready", actions: "assignReader" },
            onError: { target: "error" },
          },
        },
        ready: {},
        error: { on: { RETRY: { target: "loading" } } },
      },
    },

    edit: {
      initial: "viewing",
      states: {
        viewing: { on: { EDIT: { guard: "isEditable", target: "editing" } } },
        saved: { on: { EDIT: { guard: "isEditable", target: "editing" } } },
        editing: {
          on: {
            SAVE: { target: "saving", actions: "clearRefusal" },
            CHANGE: { actions: "clearRefusal" },
            CANCEL: { target: "viewing", actions: "clearRefusal" },
          },
        },
        saving: {
          invoke: {
            src: "updateReader",
            input: ({ context, event }: { context: Context; event: Event }) => ({
              id: context.id,
              details: event.type === "SAVE" ? event.details : null,
            }),
            onDone: { target: "saved", actions: "assignReader" },
            onError: [
              { guard: "isRefusal", target: "editing", actions: "assignRefusal" },
              { target: "editing", actions: "assignFailure" },
            ],
          },
        },
      },
    },

    action: {
      initial: "idle",
      states: {
        idle: {
          on: {
            ASK: [
              // Restoring is harmless and reversible: nothing to confirm.
              { guard: "isRestore", target: "working", actions: "assignAction" },
              { guard: "isAllowed", target: "confirming", actions: "assignAction" },
            ],
          },
        },
        confirming: {
          on: {
            CONFIRM: [
              // Erasing cannot be undone, so it asks a second time (D80).
              { guard: "isErase", target: "confirmingAgain" },
              { target: "working" },
            ],
            KEEP: { target: "idle", actions: "clearAction" },
          },
        },
        confirmingAgain: {
          on: {
            CONFIRM: { target: "working" },
            KEEP: { target: "idle", actions: "clearAction" },
          },
        },
        working: {
          invoke: {
            src: "runAction",
            input: ({ context }: { context: Context }) => ({ id: context.id, action: context.action }),
            onDone: { target: "idle", actions: ["assignReader", "clearAction"] },
            onError: { target: "failed" },
          },
        },
        failed: {
          on: {
            CONFIRM: { target: "working" },
            KEEP: { target: "idle", actions: "clearAction" },
          },
        },
      },
    },
  },
} as const;
