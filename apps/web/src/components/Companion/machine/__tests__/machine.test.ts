import { describe, expect, it } from "vitest";
import { createActor, fromPromise } from "xstate";

import { ApiError } from "../../../../lib/fetcher";
import type { Turn } from "../types";
import { companionMachine } from "..";

type Sent = { opening?: boolean; question?: string; history?: Turn[] };

/** Stub replies: a queue of outcomes, each an answer or a status to fail with. */
function start(outcomes: (string | number)[]) {
  const sent: Sent[] = [];
  const next = async (payload: Sent) => {
    sent.push(payload);
    const outcome = outcomes.shift() ?? "ok";
    if (typeof outcome === "number") throw new ApiError(outcome, null);
    return { answer: outcome };
  };
  const machine = companionMachine.provide({
    actors: {
      openCompanion: fromPromise<{ answer: string }, { token: string }>(() => next({ opening: true })),
      askCompanion: fromPromise<{ answer: string }, { token: string; question: string; history: Turn[] }>(
        ({ input }) => next({ question: input.question, history: input.history }),
      ),
    },
  });
  return { actor: createActor(machine, { input: { token: "t" } }).start(), sent };
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe("the companion (D13, D14, D88)", () => {
  it("stays closed and silent until opened", () => {
    const { actor, sent } = start([]);
    expect(actor.getSnapshot().matches("closed")).toBe(true);
    expect(sent).toEqual([]);
  });

  it("speaks first when opened", async () => {
    const { actor, sent } = start(["What made the author start with the instrument?"]);
    actor.send({ type: "OPEN" });
    expect(actor.getSnapshot().matches("opening")).toBe(true);
    await settle();

    expect(sent).toEqual([{ opening: true }]);
    expect(actor.getSnapshot().context.turns).toEqual([
      { role: "companion", text: "What made the author start with the instrument?" },
    ]);
  });

  it("sends the thread so far with each message", async () => {
    const { actor, sent } = start(["Q1?", "Say more?"]);
    actor.send({ type: "OPEN" });
    await settle();

    actor.send({ type: "ASK", question: "  Because tools are cheap.  " });
    expect(actor.getSnapshot().context.turns.at(-1)).toEqual({ role: "reader", text: "Because tools are cheap." });
    await settle();

    expect(sent[1]).toEqual({ question: "Because tools are cheap.", history: [{ role: "companion", text: "Q1?" }] });
    expect(actor.getSnapshot().context.turns.map((t) => t.role)).toEqual(["companion", "reader", "companion"]);
  });

  it("returns to the conversation on reopening, without a new opening", async () => {
    const { actor, sent } = start(["Q1?"]);
    actor.send({ type: "OPEN" });
    await settle();
    actor.send({ type: "CLOSE" });
    actor.send({ type: "OPEN" });

    expect(actor.getSnapshot().matches("idle")).toBe(true);
    expect(sent).toHaveLength(1);
  });

  it("does not send an empty message", async () => {
    const { actor, sent } = start(["Q1?"]);
    actor.send({ type: "OPEN" });
    await settle();
    actor.send({ type: "ASK", question: "   " });
    expect(actor.getSnapshot().matches("idle")).toBe(true);
    expect(sent).toHaveLength(1);
  });

  it("keeps a failed message on screen and resends it unchanged", async () => {
    const { actor, sent } = start(["Q1?", 500, "Answer"]);
    actor.send({ type: "OPEN" });
    await settle();
    actor.send({ type: "ASK", question: "Why?" });
    await settle();
    expect(actor.getSnapshot().matches("askFailed")).toBe(true);

    actor.send({ type: "RETRY" });
    await settle();
    expect(sent[2]).toEqual(sent[1]);
    expect(actor.getSnapshot().context.turns.map((t) => t.text)).toEqual(["Q1?", "Why?", "Answer"]);
  });

  it("treats the daily cap as a calm pause", async () => {
    const { actor } = start(["Q1?", 429]);
    actor.send({ type: "OPEN" });
    await settle();
    actor.send({ type: "ASK", question: "Why?" });
    await settle();
    expect(actor.getSnapshot().matches("paused")).toBe(true);
    expect(actor.getSnapshot().context.pause).toBe("capped");
  });

  it("says when the companion is unavailable, even before it speaks", async () => {
    const { actor } = start([503]);
    actor.send({ type: "OPEN" });
    await settle();
    expect(actor.getSnapshot().context.pause).toBe("unavailable");
  });

  it("lets a too-long message be shortened and sent again", async () => {
    const { actor, sent } = start(["Q1?", 422, "Better."]);
    actor.send({ type: "OPEN" });
    await settle();
    actor.send({ type: "ASK", question: "x".repeat(50) });
    await settle();
    expect(actor.getSnapshot().context.pause).toBe("tooLong");

    actor.send({ type: "ASK", question: "Shorter." });
    await settle();
    expect(sent.at(-1)).toEqual({ question: "Shorter.", history: [{ role: "companion", text: "Q1?" }] });
    expect(actor.getSnapshot().context.turns.map((t) => t.text)).toEqual(["Q1?", "Shorter.", "Better."]);
  });

  it("can retry an opening that failed", async () => {
    const { actor } = start([500, "Q1?"]);
    actor.send({ type: "OPEN" });
    await settle();
    expect(actor.getSnapshot().matches("openingFailed")).toBe(true);
    actor.send({ type: "RETRY" });
    await settle();
    expect(actor.getSnapshot().context.turns).toHaveLength(1);
  });
});
