import { describe, expect, it } from "vitest";
import { createActor, fromPromise } from "xstate";

import { ApiError } from "../../../../../lib/fetcher";
import type { ReaderDetail } from "../../../types";
import { readerMachine, type Action, type Details } from "..";

const READER: ReaderDetail = {
  id: "7", fullName: "Ada", email: "ada@x.com", phone: "+919000000000", isActive: true,
  isStaff: false, isErased: false, bookCount: 1, joinedAt: "", books: [],
};

function start(options: { reader?: ReaderDetail; save?: "ok" | "refused"; } = {}) {
  const runs: Action[] = [];
  const machine = readerMachine.provide({
    actors: {
      fetchReader: fromPromise<ReaderDetail, { id: string }>(async () => options.reader ?? READER),
      updateReader: fromPromise<ReaderDetail, { id: string; details: Details | null }>(
        async ({ input }) => {
          if (options.save === "refused") throw new ApiError(409, null, "email_taken", "email");
          return { ...READER, ...input.details };
        }),
      runAction: fromPromise<ReaderDetail, { id: string; action: Action | null }>(
        async ({ input }) => {
          if (input.action) runs.push(input.action);
          if (input.action === "deactivate") return { ...READER, isActive: false };
          if (input.action === "erase") return { ...READER, isActive: false, isErased: true };
          return { ...READER, isActive: true };
        }),
    },
  });
  return { actor: createActor(machine, { input: { id: "7" } }).start(), runs };
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe("admin: one reader (D82, D80)", () => {
  it("loads the reader", async () => {
    const { actor } = start();
    await settle();
    expect(actor.getSnapshot().context.reader?.fullName).toBe("Ada");
  });

  it("saves an edit without leaving the page", async () => {
    const { actor } = start();
    await settle();
    actor.send({ type: "EDIT" });
    actor.send({ type: "SAVE", details: { fullName: "Ada L.", email: "ada@x.com", phone: "+91" } });
    await settle();
    expect(actor.getSnapshot().matches({ edit: "saved", data: "ready" })).toBe(true);
    expect(actor.getSnapshot().context.reader?.fullName).toBe("Ada L.");
  });

  it("keeps the form open with the refusal on its field", async () => {
    const { actor } = start({ save: "refused" });
    await settle();
    actor.send({ type: "EDIT" });
    actor.send({ type: "SAVE", details: { fullName: "Ada", email: "taken@x.com", phone: "+91" } });
    await settle();
    expect(actor.getSnapshot().matches({ edit: "editing" })).toBe(true);
    expect(actor.getSnapshot().context.refusal?.field).toBe("email");
  });

  it("removes only after one confirmation", async () => {
    const { actor, runs } = start();
    await settle();
    actor.send({ type: "ASK", action: "deactivate" });
    expect(actor.getSnapshot().matches({ action: "confirming" })).toBe(true);
    expect(runs).toEqual([]);
    actor.send({ type: "CONFIRM" });
    await settle();
    expect(runs).toEqual(["deactivate"]);
    expect(actor.getSnapshot().context.reader?.isActive).toBe(false);
  });

  it("erases only after two confirmations", async () => {
    const { actor, runs } = start();
    await settle();
    actor.send({ type: "ASK", action: "erase" });
    actor.send({ type: "CONFIRM" });
    expect(actor.getSnapshot().matches({ action: "confirmingAgain" })).toBe(true);
    expect(runs).toEqual([]);
    actor.send({ type: "CONFIRM" });
    await settle();
    expect(runs).toEqual(["erase"]);
  });

  it("keeping backs out without doing anything", async () => {
    const { actor, runs } = start();
    await settle();
    actor.send({ type: "ASK", action: "erase" });
    actor.send({ type: "KEEP" });
    expect(actor.getSnapshot().matches({ action: "idle" })).toBe(true);
    expect(runs).toEqual([]);
  });

  it("restores at once: it is reversible", async () => {
    const { actor, runs } = start({ reader: { ...READER, isActive: false } });
    await settle();
    actor.send({ type: "ASK", action: "reactivate" });
    await settle();
    expect(runs).toEqual(["reactivate"]);
  });

  it("an erased reader can be neither edited nor acted on", async () => {
    const { actor, runs } = start({ reader: { ...READER, isActive: false, isErased: true } });
    await settle();
    actor.send({ type: "EDIT" });
    actor.send({ type: "ASK", action: "reactivate" });
    expect(actor.getSnapshot().matches({ edit: "viewing", action: "idle" })).toBe(true);
    expect(runs).toEqual([]);
  });
});
