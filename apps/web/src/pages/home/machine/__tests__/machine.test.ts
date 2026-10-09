import { describe, expect, it } from "vitest";
import { createActor, fromPromise } from "xstate";

import { ApiError } from "../../../../lib/fetcher";
import { homeMachine } from "..";
import type { Book } from "../types";

const ARRIVED = {
  id: "c1",
  number: 1,
  title: "The Long Descent",
  read: false,
  progress: 0,
  completed: false,
  locked: false,
  unlocksAt: null,
};

/** Chapter two, still with cadence (#114). */
const TO_COME = {
  ...ARRIVED,
  id: "c2",
  number: 2,
  title: "Clocks and Calendars",
  locked: true,
  unlocksAt: "2026-10-17T08:00:00+05:30",
};

const BOOKS: Book[] = [
  {
    id: "b1",
    title: "The Sapien Paradox",
    progress: 0,
    chapters: [ARRIVED],
  },
];

/** A shelf part delivered and part scheduled — the ordinary state of a book. */
const PARTLY_UNLOCKED: Book[] = [{ ...BOOKS[0], chapters: [ARRIVED, TO_COME] }];

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

  /*
   * Locked rows must reach the list: Home is where a reader sees the shape of
   * their book, and a payload of only-delivered chapters hides the schedule
   * they are living inside (#114).
   */
  it("keeps the chapters cadence has not released yet", async () => {
    const actor = start({ home: PARTLY_UNLOCKED });
    await settle();

    const [book] = actor.getSnapshot().context.books;
    expect(book.chapters.map((c) => c.locked)).toEqual([false, true]);
    expect(book.chapters[1].unlocksAt).not.toBeNull();
  });

  it("a book whose chapters are all still to come is ready, not empty", async () => {
    const actor = start({ home: [{ ...BOOKS[0], chapters: [TO_COME] }] });
    await settle();

    expect(actor.getSnapshot().matches({ list: "ready" })).toBe(true);
  });
});
