import { describe, expect, it } from "vitest";
import { createActor, fromPromise } from "xstate";

import { ApiError } from "../../../../lib/fetcher";
import { readerMachine } from "..";
import { nextSendDelay } from "../actions";
import type { ChapterMeta } from "../types";

const CHAPTER: ChapterMeta = {
  bookTitle: "The Sapien Paradox",
  number: 1,
  title: "The Long Descent",
  firstOpen: false,
  furthest: 0,
  completed: false,
};

function start(
  options: {
    grant?: "ok" | 404 | 410 | 403 | 500;
    reissue?: "ok" | 429 | 500;
    firstOpen?: boolean;
    completed?: boolean;
    furthest?: number;
    complete?: "ok" | 500;
    save?: "ok" | 500;
    saved?: number[];
    flushed?: number[];
  } = {},
) {
  const machine = readerMachine.provide({
    // One beat of the ceremony, and the progress region's wait, shrunk so the
    // tests do not wait on them.
    delays: { beat: 5, sendDelay: 10 },
    actions: {
      sendOnExit: ({ context }) => {
        options.flushed?.push(context.latest);
      },
    },
    actors: {
      saveProgress: fromPromise<number, { token: string; furthest: number }>(async ({ input }) => {
        if (options.save === 500) throw new ApiError(500, null);
        options.saved?.push(input.furthest);
        return input.furthest;
      }),
      fetchGrant: fromPromise<ChapterMeta, { token: string }>(async () => {
        const outcome = options.grant ?? "ok";
        if (outcome !== "ok") throw new ApiError(outcome, null);
        return {
          ...CHAPTER,
          firstOpen: options.firstOpen ?? false,
          completed: options.completed ?? false,
          furthest: options.furthest ?? 0,
        };
      }),
      completeChapter: fromPromise<void, { token: string }>(async () => {
        if (options.complete === 500) throw new ApiError(500, null);
      }),
      reissueGrant: fromPromise<void, { token: string }>(async () => {
        if (options.reissue && options.reissue !== "ok") {
          throw new ApiError(options.reissue, null);
        }
      }),
    },
  });
  return createActor(machine, { input: { token: "tok_1" } }).start();
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe("the chamber", () => {
  it("renders the chapter for a live token, with no session", async () => {
    const actor = start();
    await settle();

    expect(actor.getSnapshot().matches({ chamber: "reading" })).toBe(true);
    expect(actor.getSnapshot().context.chapter).toEqual(CHAPTER);
  });

  it("sends an expired link to sanctuary", async () => {
    const actor = start({ grant: 410 });
    await settle();

    expect(actor.getSnapshot().matches({ chamber: "sanctuary" })).toBe(true);
  });

  it("treats an unknown token as sanctuary too", async () => {
    const actor = start({ grant: 404 });
    await settle();

    expect(actor.getSnapshot().matches({ chamber: "sanctuary" })).toBe(true);
  });

  it("keeps denied distinct from sanctuary, because no button helps", async () => {
    const actor = start({ grant: 403 });
    await settle();

    expect(actor.getSnapshot().matches({ chamber: "denied" })).toBe(true);
    expect(actor.getSnapshot().matches({ chamber: "sanctuary" })).toBe(false);
  });

  it("offers a retry on a transport failure", async () => {
    const actor = start({ grant: 500 });
    await settle();

    actor.send({ type: "RETRY" });

    expect(actor.getSnapshot().matches({ chamber: "loading" })).toBe(true);
  });

  it("finishes without ceremony", async () => {
    const actor = start();
    await settle();

    actor.send({ type: "FINISH" });
    await settle();

    expect(actor.getSnapshot().matches({ chamber: "finished" })).toBe(true);
  });
});

describe("re-issue from sanctuary", () => {
  it("does not blank the sanctuary screen while sending", async () => {
    const actor = start({ grant: 410 });
    await settle();

    actor.send({ type: "REISSUE" });

    expect(actor.getSnapshot().matches({ chamber: "sanctuary" })).toBe(true);
    expect(actor.getSnapshot().matches({ reissue: "sending" })).toBe(true);
  });

  it("confirms a fresh link is on its way", async () => {
    const actor = start({ grant: 410 });
    await settle();

    actor.send({ type: "REISSUE" });
    await settle();

    expect(actor.getSnapshot().matches({ reissue: "sent" })).toBe(true);
  });

  it("reads a rate limit as already-sent, not as a failure", async () => {
    const actor = start({ grant: 410, reissue: 429 });
    await settle();

    actor.send({ type: "REISSUE" });
    await settle();

    expect(actor.getSnapshot().matches({ reissue: "limited" })).toBe(true);
  });

  it("allows another attempt after a real failure", async () => {
    const actor = start({ grant: 410, reissue: 500 });
    await settle();
    actor.send({ type: "REISSUE" });
    await settle();
    expect(actor.getSnapshot().matches({ reissue: "failed" })).toBe(true);

    actor.send({ type: "REISSUE" });

    expect(actor.getSnapshot().matches({ reissue: "sending" })).toBe(true);
  });
});

describe("the threshold ceremony (#116)", () => {
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  it("plays on the first open of a link", async () => {
    const actor = start({ firstOpen: true });
    await settle();

    expect(actor.getSnapshot().matches({ chamber: { threshold: "gathering" } })).toBe(true);
    expect(actor.getSnapshot().context.chapter?.title).toBe(CHAPTER.title);
  });

  it("walks its four beats in order, then opens the chamber", async () => {
    const actor = start({ firstOpen: true });
    await settle();

    const seen: string[] = [];
    actor.subscribe((snapshot) => {
      for (const beat of ["gathering", "titled", "ruled", "lifting"] as const) {
        if (snapshot.matches({ chamber: { threshold: beat } }) && seen.at(-1) !== beat) {
          seen.push(beat);
        }
      }
    });

    await wait(60);

    expect(seen).toEqual(["titled", "ruled", "lifting"]);
    expect(actor.getSnapshot().matches({ chamber: "reading" })).toBe(true);
  });

  it("skips straight to the chamber on a tap", async () => {
    const actor = start({ firstOpen: true });
    await settle();

    actor.send({ type: "SKIP" });

    expect(actor.getSnapshot().matches({ chamber: "reading" })).toBe(true);
  });

  it("does not play when the link has been opened before", async () => {
    const actor = start({ firstOpen: false });
    await settle();

    expect(actor.getSnapshot().matches({ chamber: "reading" })).toBe(true);
  });
});

describe("marking a chapter complete (D70)", () => {
  it("saves before it shows the chapter as finished", async () => {
    const actor = start();
    await settle();

    actor.send({ type: "FINISH" });
    expect(actor.getSnapshot().matches({ chamber: "completing" })).toBe(true);

    await settle();
    expect(actor.getSnapshot().matches({ chamber: "finished" })).toBe(true);
  });

  it("offers the button again when the save fails", async () => {
    const actor = start({ complete: 500 });
    await settle();

    actor.send({ type: "FINISH" });
    await settle();
    expect(actor.getSnapshot().matches({ chamber: "completeFailed" })).toBe(true);

    actor.send({ type: "FINISH" });
    expect(actor.getSnapshot().matches({ chamber: "completing" })).toBe(true);
  });

  it("reopens a completed chapter at its end state", async () => {
    const actor = start({ completed: true });
    await settle();

    expect(actor.getSnapshot().matches({ chamber: "finished" })).toBe(true);
  });
});

describe("the progress region (D70, D42)", () => {
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  it("sends once after the reader moves, with the furthest point reached", async () => {
    const saved: number[] = [];
    const actor = start({ saved });
    await settle();

    actor.send({ type: "PROGRESS", fraction: 0.2 });
    actor.send({ type: "PROGRESS", fraction: 0.35 });
    actor.send({ type: "PROGRESS", fraction: 0.3 });
    expect(actor.getSnapshot().matches({ progress: "waiting" })).toBe(true);

    await wait(40);
    expect(saved).toEqual([0.35]);
    expect(actor.getSnapshot().matches({ progress: "idle" })).toBe(true);
  });

  it("ignores movements too small to be worth a request", async () => {
    const actor = start({ furthest: 0.5 });
    await settle();

    actor.send({ type: "PROGRESS", fraction: 0.505 });

    expect(actor.getSnapshot().matches({ progress: "idle" })).toBe(true);
  });

  it("starts from where the reader left off, so nothing is re-sent", async () => {
    const actor = start({ furthest: 0.6 });
    await settle();

    actor.send({ type: "PROGRESS", fraction: 0.4 });

    expect(actor.getSnapshot().matches({ progress: "idle" })).toBe(true);
    expect(actor.getSnapshot().context.latest).toBe(0.6);
  });

  it("goes round again when the reader kept going during a save", async () => {
    const saved: number[] = [];
    const actor = start({ saved });
    await settle();

    actor.send({ type: "PROGRESS", fraction: 0.2 });
    await wait(15);
    actor.send({ type: "PROGRESS", fraction: 0.5 });
    await wait(60);

    expect(saved.at(-1)).toBe(0.5);
  });

  it("flushes what is unsent when the page closes, and nothing when there is nothing", async () => {
    const flushed: number[] = [];
    const actor = start({ flushed });
    await settle();

    actor.send({ type: "FLUSH" });
    expect(flushed).toEqual([]);

    actor.send({ type: "PROGRESS", fraction: 0.4 });
    actor.send({ type: "FLUSH" });
    expect(flushed).toEqual([0.4]);
    expect(actor.getSnapshot().matches({ progress: "idle" })).toBe(true);
  });

  it("sends nothing more once the chapter is complete", async () => {
    const saved: number[] = [];
    const actor = start({ saved });
    await settle();

    actor.send({ type: "FINISH" });
    await settle();
    actor.send({ type: "PROGRESS", fraction: 0.9 });

    expect(actor.getSnapshot().matches({ progress: "idle" })).toBe(true);
    expect(actor.getSnapshot().context.completed).toBe(true);
  });

  it("a failed save leaves the region ready for the next movement", async () => {
    const actor = start({ save: 500 });
    await settle();

    actor.send({ type: "PROGRESS", fraction: 0.3 });
    await wait(40);

    expect(actor.getSnapshot().matches({ progress: "idle" })).toBe(true);
  });
});

describe("nextSendDelay", () => {
  it("waits for the settle, and never sends more often than every five seconds", () => {
    expect(nextSendDelay(100_000, 0)).toBe(1500);
    expect(nextSendDelay(10_000, 9_000)).toBe(4000);
  });
});
