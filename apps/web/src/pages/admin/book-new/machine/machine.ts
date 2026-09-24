/**
 * Admin · New book — level 1 (D84). The short form that creates a draft.
 *
 *   editing ──SUBMIT──▶ saving → done (the screen opens the workspace)
 *                           └─ refused / failed → editing, with the reason
 */

import type { Context, Event } from "./types";

const initialContext: Context = { createdId: null, refusal: null };

export const newBookConfig = {
  id: "adminNewBook",
  initial: "editing",
  context: initialContext,
  states: {
    editing: {
      on: {
        SUBMIT: { guard: "hasTitle", target: "saving", actions: "clearRefusal" },
        EDIT: { actions: "clearRefusal" },
      },
    },
    saving: {
      invoke: {
        src: "createBook",
        input: ({ event }: { event: Event }) => (event.type === "SUBMIT" ? event.book : null),
        onDone: { target: "done", actions: "assignCreated" },
        onError: { target: "editing", actions: "assignRefusal" },
      },
    },
    done: { type: "final" },
  },
} as const;
