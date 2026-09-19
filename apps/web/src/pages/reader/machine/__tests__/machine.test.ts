import { describe, expect, it } from "vitest";
import { createActor, fromPromise } from "xstate";

import { ApiError } from "../../../../lib/fetcher";
import { readerMachine } from "..";
import type { ChapterMeta } from "../types";

const CHAPTER: ChapterMeta = {
  bookTitle: "The Sapien Paradox",
  number: 1,
  title: "The Long Descent",
};

function start(
  options: { grant?: "ok" | 404 | 410 | 403 | 500; reissue?: "ok" | 429 | 500 } = {},
) {
  const machine = readerMachine.provide({
    actors: {
      fetchGrant: fromPromise<ChapterMeta, { token: string }>(async () => {
        const outcome = options.grant ?? "ok";
        if (outcome !== "ok") throw new ApiError(outcome, null);
        return CHAPTER;
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
