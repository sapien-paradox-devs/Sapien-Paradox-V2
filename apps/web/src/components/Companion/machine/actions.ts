import type { AnyEventObject } from "xstate";

import type { Context, Event, Exchange } from "./types";

export function rememberQuestion({ event }: { event: Event }): Pick<Context, "pending"> {
  return { pending: event.type === "ASK" ? event.question : "" };
}

export function recordAnswer({
  context,
  event,
}: {
  context: Context;
  event: AnyEventObject;
}): Pick<Context, "exchanges" | "pending"> {
  const output = "output" in event ? event.output : null;
  const answer = answerOf(output);

  const exchange: Exchange = { question: context.pending, answer };
  return { exchanges: [...context.exchanges, exchange], pending: "" };
}

function answerOf(value: unknown): string {
  if (typeof value === "object" && value !== null && "answer" in value) {
    const { answer } = value;
    if (typeof answer === "string") return answer;
  }
  return "";
}
