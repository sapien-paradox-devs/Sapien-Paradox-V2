import { describe, expect, it, vi } from "vitest";
import { createActor, fromPromise } from "xstate";

import { ApiError } from "../../../../lib/fetcher";
import type { ResetConfirm } from "../actors";
import { resetMachine } from "..";

const GOOD = { type: "SUBMIT", password: "longenough", confirm: "longenough" } as const;

function start(outcome: "ok" | 410 | 422 | 500 = "ok", spy?: (input: ResetConfirm) => void) {
  const machine = resetMachine.provide({
    actors: {
      confirmActor: fromPromise<void, ResetConfirm>(async ({ input }) => {
        spy?.(input);
        if (outcome === "ok") return;
        throw new ApiError(outcome, null);
      }),
    },
  });
  return createActor(machine, { input: { token: "tok_123" } }).start();
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe("the set-password machine", () => {
  it("sends the token from the URL with the new password", async () => {
    const seen = vi.fn();
    const actor = start("ok", seen);

    actor.send(GOOD);
    await settle();

    expect(seen).toHaveBeenCalledWith({ token: "tok_123", password: "longenough" });
    expect(actor.getSnapshot().matches("done")).toBe(true);
  });

  it("refuses a short password without a round trip", () => {
    const seen = vi.fn();
    const actor = start("ok", seen);

    actor.send({ type: "SUBMIT", password: "short", confirm: "short" });

    expect(seen).not.toHaveBeenCalled();
    expect(actor.getSnapshot().matches("idle")).toBe(true);
    expect(actor.getSnapshot().context.errorMessage).toMatch(/8 characters/i);
  });

  it("refuses two passwords that do not match, without a round trip", () => {
    const seen = vi.fn();
    const actor = start("ok", seen);

    actor.send({ type: "SUBMIT", password: "longenough", confirm: "longenougi" });

    expect(seen).not.toHaveBeenCalled();
    expect(actor.getSnapshot().context.errorMessage).toMatch(/do not match/i);
  });

  it("treats a spent link as terminal, not retryable", async () => {
    const actor = start(410);

    actor.send(GOOD);
    await settle();

    expect(actor.getSnapshot().matches("dead")).toBe(true);
    expect(actor.getSnapshot().context.linkDead).toBe(true);
    expect(actor.getSnapshot().context.errorMessage).toMatch(/already been used|rested/i);
  });

  it("stays dead even if the reader submits again", async () => {
    const actor = start(410);
    actor.send(GOOD);
    await settle();

    actor.send(GOOD);

    expect(actor.getSnapshot().matches("dead")).toBe(true);
  });

  it("lets the reader try again after an outage", async () => {
    const actor = start(500);
    actor.send(GOOD);
    await settle();

    expect(actor.getSnapshot().matches("idle")).toBe(true);
    expect(actor.getSnapshot().context.errorMessage).toMatch(/could not reach/i);

    actor.send(GOOD);
    expect(actor.getSnapshot().matches("submitting")).toBe(true);
  });

  it("echoes the server's length rule with the same words as the local one", async () => {
    const actor = start(422);

    actor.send(GOOD);
    await settle();

    expect(actor.getSnapshot().context.errorMessage).toMatch(/8 characters/i);
  });

  it("clears the error as soon as the reader starts correcting it", () => {
    const actor = start();
    actor.send({ type: "SUBMIT", password: "short", confirm: "short" });

    actor.send({ type: "EDIT" });

    expect(actor.getSnapshot().context.errorMessage).toBeNull();
  });
});
