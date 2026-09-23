import { describe, expect, it } from "vitest";
import { createActor, fromPromise } from "xstate";

import { ApiError } from "../../../../../lib/fetcher";
import type { BookOption } from "../../../types";
import type { Created } from "../actors";
import { newReaderMachine, type NewReader } from "..";

const BOOK: BookOption = { slug: "tsp", title: "The Sapien Paradox", priceMinorUnits: 0, chapterCount: 5 };
const READER: NewReader = {
  fullName: "Ada", email: "ada@x.com", phone: "+919000000000", bookSlug: "tsp", pace: "medium",
};

function start(outcome: "ok" | "undelivered" | "refused" | 500 = "ok") {
  const machine = newReaderMachine.provide({
    actors: {
      fetchBooks: fromPromise<BookOption[]>(async () => [BOOK]),
      createReader: fromPromise<Created, NewReader | null>(async () => {
        if (outcome === "refused") throw new ApiError(409, null, "already_owns_book", "bookSlug");
        if (outcome === 500) throw new ApiError(500, null);
        return {
          reader: { id: "7", fullName: "Ada", email: "ada@x.com", phone: "+91", isActive: true,
            isStaff: false, isErased: false, bookCount: 1, joinedAt: "", books: [] },
          delivered: outcome === "ok",
        };
      }),
    },
  });
  return createActor(machine).start();
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe("admin: add a reader (D82, D26)", () => {
  it("loads the books, then saves and finishes", async () => {
    const actor = start();
    await settle();
    expect(actor.getSnapshot().context.books).toEqual([BOOK]);
    actor.send({ type: "SUBMIT", reader: READER });
    await settle();
    expect(actor.getSnapshot().status).toBe("done");
    expect(actor.getSnapshot().context.created?.id).toBe("7");
    expect(actor.getSnapshot().context.delivered).toBe(true);
  });

  it("reports a chapter 1 that did not reach WhatsApp", async () => {
    const actor = start("undelivered");
    await settle();
    actor.send({ type: "SUBMIT", reader: READER });
    await settle();
    expect(actor.getSnapshot().context.delivered).toBe(false);
  });

  it("puts a refusal back on its field, and clears it on edit", async () => {
    const actor = start("refused");
    await settle();
    actor.send({ type: "SUBMIT", reader: READER });
    await settle();
    expect(actor.getSnapshot().matches("editing")).toBe(true);
    expect(actor.getSnapshot().context.refusal).toEqual({ code: "already_owns_book", field: "bookSlug" });
    actor.send({ type: "EDIT" });
    expect(actor.getSnapshot().context.refusal).toBeNull();
  });

  it("does not submit an incomplete form", async () => {
    const actor = start();
    await settle();
    actor.send({ type: "SUBMIT", reader: { ...READER, phone: " " } });
    expect(actor.getSnapshot().matches("editing")).toBe(true);
  });

  it("an unexpected failure is not a refusal", async () => {
    const actor = start(500);
    await settle();
    actor.send({ type: "SUBMIT", reader: READER });
    await settle();
    expect(actor.getSnapshot().matches("failed")).toBe(true);
  });
});
