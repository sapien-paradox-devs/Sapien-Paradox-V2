import { describe, expect, it } from "vitest";
import { createActor, fromPromise } from "xstate";

import { ApiError } from "../../../../lib/fetcher";
import { homeMachine } from "..";
import type { Book } from "../types";

const BOOKS: Book[] = [
  {
    id: "b1",
    title: "The Sapien Paradox",
    chapters: [{ id: "c1", number: 1, title: "The Long Descent", read: false }],
  },
];

function start(options: { home?: Book[] | "error"; send?: "ok" | 429 | 500 } = {}) {
  const machine = homeMachine.provide({
    actors: {
      fetchHome: fromPromise<{ books: Book[] }>(async () => {
        if (options.home === "error") throw new ApiError(500, null);
        return { books: options.home ?? BOOKS };
      }),
      sendChapter: fromPromise<void, { chapterId: string }>(async () => {
        if (options.send && options.send !== "ok") {
          throw new ApiError(options.send, null);
        }
      }),
    },
  });
  return createActor(machine).start();
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe("the list region", () => {
  it("reaches ready with the books", async () => {
    const actor = start();
    await settle();

    expect(actor.getSnapshot().matches({ list: "ready" })).toBe(true);
    expect(actor.getSnapshot().context.books).toEqual(BOOKS);
  });

  it("says empty rather than showing an empty frame", async () => {
    const actor = start({ home: [] });
    await settle();

    expect(actor.getSnapshot().matches({ list: "empty" })).toBe(true);
  });

  it("offers a retry after a failure", async () => {
    const actor = start({ home: "error" });
    await settle();
    expect(actor.getSnapshot().matches({ list: "error" })).toBe(true);

    actor.send({ type: "RETRY" });

    expect(actor.getSnapshot().matches({ list: "loading" })).toBe(true);
  });
});

describe("the send region", () => {
  it("keeps the list readable while a send is in flight", async () => {
    const actor = start();
    await settle();

    actor.send({ type: "SEND", chapterId: "c1" });

    // The whole point of the parallel region (D42).
    expect(actor.getSnapshot().matches({ list: "ready" })).toBe(true);
    expect(actor.getSnapshot().matches({ send: "sending" })).toBe(true);
  });

  it("reaches sent on success", async () => {
    const actor = start();
    await settle();

    actor.send({ type: "SEND", chapterId: "c1" });
    await settle();

    expect(actor.getSnapshot().matches({ send: "sent" })).toBe(true);
  });

  it("treats a rate limit as already-sent, not as a failure", async () => {
    const actor = start({ send: 429 });
    await settle();

    actor.send({ type: "SEND", chapterId: "c1" });
    await settle();

    expect(actor.getSnapshot().matches({ send: "limited" })).toBe(true);
    expect(actor.getSnapshot().matches({ send: "failed" })).toBe(false);
  });

  it("keeps a real failure distinct from a rate limit", async () => {
    const actor = start({ send: 500 });
    await settle();

    actor.send({ type: "SEND", chapterId: "c1" });
    await settle();

    expect(actor.getSnapshot().matches({ send: "failed" })).toBe(true);
  });

  it("remembers which chapter is being sent", async () => {
    const actor = start();
    await settle();

    actor.send({ type: "SEND", chapterId: "c1" });

    expect(actor.getSnapshot().context.sendingChapterId).toBe("c1");
  });

  it("allows a retry after a real failure", async () => {
    const actor = start({ send: 500 });
    await settle();
    actor.send({ type: "SEND", chapterId: "c1" });
    await settle();

    actor.send({ type: "SEND", chapterId: "c1" });

    expect(actor.getSnapshot().matches({ send: "sending" })).toBe(true);
  });
});
