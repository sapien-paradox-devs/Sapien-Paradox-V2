import { describe, expect, it } from "vitest";
import { createActor, fromPromise } from "xstate";

import { ApiError } from "../../../../../lib/fetcher";
import type { ReaderRow } from "../../../types";
import type { ReaderQuery } from "../actors";
import { readersMachine } from "..";

const row = (email: string): ReaderRow => ({
  id: email, fullName: email, email, phone: "+91", isActive: true, isStaff: false,
  isErased: false, bookCount: 1, joinedAt: "2026-09-24T00:00:00Z",
});

function start(fail = false) {
  const queries: ReaderQuery[] = [];
  const machine = readersMachine.provide({
    delays: { searchPause: 5 },
    actors: {
      fetchReaders: fromPromise<ReaderRow[], ReaderQuery>(async ({ input }) => {
        queries.push(input);
        if (fail) throw new ApiError(500, null);
        return [row("a@x.com")];
      }),
    },
  });
  return { actor: createActor(machine).start(), queries };
}

const wait = (ms = 0) => new Promise((r) => setTimeout(r, ms));

describe("admin readers (D82)", () => {
  it("loads the list", async () => {
    const { actor } = start();
    await wait();
    expect(actor.getSnapshot().matches("ready")).toBe(true);
    expect(actor.getSnapshot().context.readers).toHaveLength(1);
  });

  it("waits for a pause in typing, then searches once", async () => {
    const { actor, queries } = start();
    await wait();
    actor.send({ type: "SEARCH", search: "a" });
    actor.send({ type: "SEARCH", search: "ad" });
    actor.send({ type: "SEARCH", search: "ada" });
    await wait(20);
    expect(queries.map((q) => q.search)).toEqual(["", "ada"]);
  });

  it("filters by status at once", async () => {
    const { actor, queries } = start();
    await wait();
    actor.send({ type: "STATUS", status: "inactive" });
    await wait();
    expect(queries.at(-1)).toEqual({ search: "", status: "inactive" });
  });

  it("shows an error and retries", async () => {
    const { actor } = start(true);
    await wait();
    expect(actor.getSnapshot().matches("error")).toBe(true);
    actor.send({ type: "RETRY" });
    expect(actor.getSnapshot().matches("loading")).toBe(true);
  });
});
