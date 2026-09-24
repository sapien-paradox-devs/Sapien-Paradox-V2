import { describe, expect, it } from "vitest";
import { createActor, fromPromise } from "xstate";

import { ApiError } from "../../../../../lib/fetcher";
import type { BookDetail } from "../../../types";
import { newBookMachine, type NewBook } from "..";

const BOOK: NewBook = { title: "The Sapien Paradox", author: "", description: "", priceMinorUnits: 0 };

function start(outcome: "ok" | "refused" | 500 = "ok") {
  const machine = newBookMachine.provide({
    actors: {
      createBook: fromPromise<BookDetail, NewBook | null>(async () => {
        if (outcome === "refused") throw new ApiError(409, null, "title_required", "title");
        if (outcome === 500) throw new ApiError(500, null);
        return { id: "5" } as BookDetail;
      }),
    },
  });
  return createActor(machine).start();
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe("admin: new book (D84)", () => {
  it("creates the draft and carries its id out", async () => {
    const actor = start();
    actor.send({ type: "SUBMIT", book: BOOK });
    await settle();
    expect(actor.getSnapshot().status).toBe("done");
    expect(actor.getSnapshot().context.createdId).toBe("5");
  });

  it("puts a refusal on its field and stays editable", async () => {
    const actor = start("refused");
    actor.send({ type: "SUBMIT", book: BOOK });
    await settle();
    expect(actor.getSnapshot().matches("editing")).toBe(true);
    expect(actor.getSnapshot().context.refusal).toEqual({ code: "title_required", field: "title" });
  });

  it("a failure without a code still says something", async () => {
    const actor = start(500);
    actor.send({ type: "SUBMIT", book: BOOK });
    await settle();
    expect(actor.getSnapshot().context.refusal).toEqual({ code: "failed", field: null });
  });

  it("does not submit without a title", () => {
    const actor = start();
    actor.send({ type: "SUBMIT", book: { ...BOOK, title: "  " } });
    expect(actor.getSnapshot().matches("editing")).toBe(true);
  });
});
