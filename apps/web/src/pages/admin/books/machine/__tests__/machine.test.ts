import { describe, expect, it } from "vitest";
import { createActor, fromPromise } from "xstate";

import { ApiError } from "../../../../../lib/fetcher";
import type { BookRow } from "../../../types";
import { booksMachine } from "..";

const ROW: BookRow = {
  id: "1", slug: "b", title: "Book", author: "", isPublished: false, chapterCount: 0,
  readyCount: 0, hasCover: false, readerCount: 0, createdAt: "",
};

function start(fail = false) {
  const machine = booksMachine.provide({
    actors: {
      fetchBooks: fromPromise<BookRow[]>(async () => {
        if (fail) throw new ApiError(500, null);
        return [ROW];
      }),
    },
  });
  return createActor(machine).start();
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe("admin: books (D82)", () => {
  it("loads every book", async () => {
    const actor = start();
    await settle();
    expect(actor.getSnapshot().context.books).toEqual([ROW]);
  });

  it("shows an error and retries", async () => {
    const actor = start(true);
    await settle();
    expect(actor.getSnapshot().matches("error")).toBe(true);
    actor.send({ type: "RETRY" });
    expect(actor.getSnapshot().matches("loading")).toBe(true);
  });
});
