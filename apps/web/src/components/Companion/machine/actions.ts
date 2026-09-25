import type { AnyEventObject } from "xstate";

import { ApiError } from "../../../lib/fetcher";
import type { Context, Event, Pause } from "./types";

export function addReaderTurn({ context, event }: { context: Context; event: Event }): Pick<Context, "turns"> {
  if (event.type !== "ASK") return { turns: context.turns };
  return { turns: [...context.turns, { role: "reader", text: event.question.trim() }] };
}

export function rememberPending({ event }: { event: Event }): Pick<Context, "pending"> {
  return { pending: event.type === "ASK" ? event.question.trim() : "" };
}

export function clearPending(): Pick<Context, "pending"> {
  return { pending: "" };
}

export function addCompanionTurn({ context, event }: { context: Context; event: AnyEventObject }): Pick<Context, "turns"> {
  const text = answerOf("output" in event ? event.output : null);
  return { turns: text ? [...context.turns, { role: "companion", text }] : context.turns };
}

export function assignPause({ event }: { event: AnyEventObject }): Pick<Context, "pause"> {
  return { pause: pauseOf(event) };
}

export function clearPause(): Pick<Context, "pause"> {
  return { pause: null };
}

/** A too-long message was refused: take it back off the screen before the retry. */
export function dropUnsentTurn({ context }: { context: Context }): Pick<Context, "turns"> {
  const last = context.turns.at(-1);
  return { turns: last?.role === "reader" ? context.turns.slice(0, -1) : context.turns };
}

/** The status codes the chat endpoint uses for its refusals (core/api/chat.py). */
export function pauseOf(event: AnyEventObject): Pause {
  if (!("error" in event) || !(event.error instanceof ApiError)) return null;
  const { status } = event.error;
  if (status === 429) return "capped";
  if (status === 503) return "unavailable";
  if (status === 409) return "notReady";
  if (status === 422) return "tooLong";
  return null;
}

function answerOf(value: unknown): string {
  if (typeof value === "object" && value !== null && "answer" in value) {
    const { answer } = value;
    if (typeof answer === "string") return answer.trim();
  }
  return "";
}
