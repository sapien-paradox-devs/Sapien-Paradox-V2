import { describe, expect, it } from "vitest";
import { createActor, fromPromise } from "xstate";

import { ApiError } from "../../../../lib/fetcher";
import { companionMachine } from "..";

function start(outcome: "ok" | 429 | 500 = "ok") {
  const machine = companionMachine.provide({
    actors: {
      askCompanion: fromPromise<{ answer: string }, { token: string; question: string }>(
        async () => {
          if (outcome !== "ok") throw new ApiError(outcome, null);
          return { answer: "Because the descent was slow." };
        },
      ),
    },
  });
  return createActor(machine, { input: { token: "tok_1" } }).start();
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe("the companion", () => {
  it("starts closed and silent", () => {
    expect(start().getSnapshot().matches("closed")).toBe(true);
  });

  it("does nothing until the reader opens it", () => {
    const actor = start();

    actor.send({ type: "ASK", question: "why?" });

    // It never interrupts, and it cannot be talked to from behind a closed
    // panel either (D14).
    expect(actor.getSnapshot().matches("closed")).toBe(true);
  });

  it("records the exchange once an answer arrives", async () => {
    const actor = start();
    actor.send({ type: "OPEN" });

    actor.send({ type: "ASK", question: "why?" });
    await settle();

    expect(actor.getSnapshot().context.exchanges).toEqual([
      { question: "why?", answer: "Because the descent was slow." },
    ]);
  });

  it("reads the cap as a boundary, not a failure", async () => {
    const actor = start(429);
    actor.send({ type: "OPEN" });

    actor.send({ type: "ASK", question: "why?" });
    await settle();

    expect(actor.getSnapshot().matches("capped")).toBe(true);
    expect(actor.getSnapshot().matches("error")).toBe(false);
  });

  it("keeps the question so a retry does not lose what was typed", async () => {
    const actor = start(500);
    actor.send({ type: "OPEN" });

    actor.send({ type: "ASK", question: "why?" });
    await settle();

    expect(actor.getSnapshot().matches("error")).toBe(true);
    expect(actor.getSnapshot().context.pending).toBe("why?");
  });

  it("retries the remembered question", async () => {
    const actor = start(500);
    actor.send({ type: "OPEN" });
    actor.send({ type: "ASK", question: "why?" });
    await settle();

    actor.send({ type: "RETRY" });

    expect(actor.getSnapshot().matches("asking")).toBe(true);
  });

  it("closes without losing the conversation", async () => {
    const actor = start();
    actor.send({ type: "OPEN" });
    actor.send({ type: "ASK", question: "why?" });
    await settle();

    actor.send({ type: "CLOSE" });

    expect(actor.getSnapshot().matches("closed")).toBe(true);
    expect(actor.getSnapshot().context.exchanges).toHaveLength(1);
  });
});
