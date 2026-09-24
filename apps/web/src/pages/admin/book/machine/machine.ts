/**
 * Admin · The book workspace — level 1 (D84). Three parallel regions (D42):
 *
 *   data     loading → ready · error
 *   ops      idle ──RUN──▶ working → idle            (one change at a time)
 *   uploads  idle ⇄ active                           (the queue, see below)
 *
 * **Staging (D86).** A dropped folder or batch of videos is held in context
 * (`stagedPdfs`, `stagedVideos`) until CONFIRM: titles, order and video slots
 * can all be fixed first, and nothing uploads until then.
 *
 * **The upload queue (D85).** Each file is an item in `uploads` and, while it
 * moves, a spawned child actor named by its id. `pump` starts what may start:
 * PDFs strictly one at a time and in order, so chapters land in the sequence the
 * admin confirmed; everything else two at a time. Every finished upload returns
 * the whole book, so the screen always redraws from the server's truth.
 */

import type { Context } from "./types";

const initialContext: Context = {
  id: "",
  book: null,
  refusal: null,
  op: null,
  stagedPdfs: null,
  stagedVideos: null,
  uploads: [],
  nextUploadId: 1,
};

export const bookConfig = {
  id: "adminBook",
  type: "parallel",
  context: initialContext,

  on: {
    STAGE_PDFS: { actions: "stagePdfs" },
    RETITLE_STAGED: { actions: "retitleStaged" },
    MOVE_STAGED: { actions: "moveStaged" },
    UNSTAGE: { actions: "unstage" },
    CONFIRM_PDFS: { guard: "hasStagedPdfs", actions: ["enqueueStagedPdfs", "pump"] },
    CANCEL_PDFS: { actions: "cancelPdfs" },

    STAGE_VIDEOS: { guard: "hasBook", actions: "stageVideos" },
    ASSIGN_VIDEO: { actions: "assignVideo" },
    CONFIRM_VIDEOS: { guard: "hasStagedVideos", actions: ["enqueueStagedVideos", "pump"] },
    CANCEL_VIDEOS: { actions: "cancelVideos" },

    UPLOAD: { actions: ["enqueueOne", "pump"] },
    RETRY_UPLOAD: { actions: ["requeue", "pump"] },
    CLEAR_UPLOADS: { actions: "clearFinished" },

    UPLOAD_PROGRESS: { actions: "markProgress" },
    UPLOAD_FINISHING: { actions: "markFinishing" },
    UPLOAD_DONE: { actions: ["markDone", "assignBookFromUpload", "pump"] },
    UPLOAD_FAILED: { actions: ["markFailed", "pump"] },

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
