import type { AnyEventObject } from "xstate";

import { pauseOf } from "./actions";
import type { Context, Event } from "./types";

/** Reopening returns to the conversation instead of asking a new opening question. */
export const hasConversation = ({ context }: { context: Context }) => context.turns.length > 0;

export const hasText = ({ event }: { event: Event }) => event.type === "ASK" && event.question.trim().length > 0;

/**
 * A refusal the panel shows as a calm state, not an error (D33, D45): the daily
 * cap, the companion unavailable, a chapter not ready, a message too long.
 */
export const isPause = ({ event }: { event: AnyEventObject }) => pauseOf(event) !== null;

/** Only a too-long message can be fixed by the reader and sent again. */
export const canAskAgain = ({ context, event }: { context: Context; event: Event }) =>
  context.pause === "tooLong" && hasText({ event });
