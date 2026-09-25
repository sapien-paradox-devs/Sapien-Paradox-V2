import { describe, expect, it } from "vitest";
import { createActor, fromPromise } from "xstate";

import { ApiError } from "../../../../../lib/fetcher";
import type { BookDetail } from "../../../types";
import type { Op } from "../types";
import { bookMachine } from "..";

const BOOK: BookDetail = {
  id: "1", slug: "b", title: "Book", author: "", isPublished: false, chapterCount: 1, readyCount: 1,
  hasCover: false, readerCount: 0, createdAt: "", description: "", priceMinorUnits: 0,
  hasVideo: false, hasSample: false,
  chapters: [{ id: "10", number: 1, title: "One", status: "ready", pageCount: 3, hasVideo: false, hasReaders: false }],
  checklist: { hasChapters: true, allReady: true, hasCover: false, passes: false },
};

function start(refuse?: string) {
  const ran: Op[] = [];
  const machine = bookMachine.provide({
    actors: {
      fetchBook: fromPromise<BookDetail, { id: string }>(async () => BOOK),
      runOp: fromPromise<BookDetail, { id: string; op: Op | null }>(async ({ input }) => {
        if (input.op) ran.push(input.op);
        if (refuse) throw new ApiError(409, null, refuse, null);
        return { ...BOOK, title: "Renamed" };
      }),
    },
  });
  return { actor: createActor(machine, { input: { id: "1" } }).start(), ran };
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe("the book workspace: loading and changes (D84)", () => {
  it("loads the book", async () => {
    const { actor } = start();
    await settle();
    expect(actor.getSnapshot().matches({ data: "ready" })).toBe(true);
  });

  it("runs a change and redraws from the book it returns", async () => {
    const { actor, ran } = start();
    await settle();
    actor.send({ type: "RUN", op: { kind: "rename", chapterId: "10", title: "Uno" } });
    expect(actor.getSnapshot().context.op).toEqual({ kind: "rename", chapterId: "10", title: "Uno" });
    await settle();
    expect(ran).toHaveLength(1);
    expect(actor.getSnapshot().context.book?.title).toBe("Renamed");
    expect(actor.getSnapshot().context.op).toBeNull();
  });

  it("shows a refusal and stays ready for the next change", async () => {
    const { actor } = start("checklist_incomplete");
    await settle();
    actor.send({ type: "RUN", op: { kind: "publish" } });
    await settle();
    expect(actor.getSnapshot().context.refusal).toEqual({ code: "checklist_incomplete", field: null });
    expect(actor.getSnapshot().matches({ ops: "idle" })).toBe(true);
    actor.send({ type: "DISMISS_REFUSAL" });
    expect(actor.getSnapshot().context.refusal).toBeNull();
  });

  it("does nothing before the book has loaded", () => {
    const { actor, ran } = start();
    actor.send({ type: "RUN", op: { kind: "publish" } });
    expect(ran).toEqual([]);
  });
});
