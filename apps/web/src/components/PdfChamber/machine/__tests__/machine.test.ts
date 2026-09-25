import { describe, expect, it } from "vitest";
import { createActor, fromPromise } from "xstate";

import { ApiError } from "../../../../lib/fetcher";
import { leaveFullscreen, pdfMachine } from "..";
import type { Layout } from "../types";

const LAYOUT: Layout = {
  pages: [
    { width: 300, height: 400 },
    { width: 300, height: 400 },
  ],
  sections: [{ title: "Opening", page: 0, depth: 0 }],
};

function start(outcome: "ok" | 404 | 500 = "ok") {
  let calls = 0;
  const machine = pdfMachine.provide({
    actors: {
      loadLayout: fromPromise<Layout, { token: string }>(async () => {
        calls += 1;
        if (outcome !== "ok" && calls === 1) throw new ApiError(outcome, null);
        return LAYOUT;
      }),
    },
  });
  return createActor(machine, { input: { token: "tok_1" } }).start();
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("the chamber's pages (D73)", () => {
  it("holds the layout once it arrives", async () => {
    const actor = start();
    await settle();

    expect(actor.getSnapshot().matches({ document: "rendered" })).toBe(true);
    expect(actor.getSnapshot().context.layout).toEqual(LAYOUT);
  });

  it("keeps its own error when the pages fail, and retries (D43)", async () => {
    const actor = start(500);
    await settle();
    expect(actor.getSnapshot().matches({ document: "error" })).toBe(true);

    actor.send({ type: "RETRY" });
    await settle();
    expect(actor.getSnapshot().matches({ document: "rendered" })).toBe(true);
  });

  it("treats a chapter that is not rendered yet as its own error, not sanctuary", async () => {
    const actor = start(404);
    await settle();

    expect(actor.getSnapshot().matches({ document: "error" })).toBe(true);
  });
});

describe("full screen (#198)", () => {
  it("goes immersive and back, marking the page for the stylesheet", async () => {
    const actor = start();
    await settle();

    actor.send({ type: "TOGGLE_FULLSCREEN" });
    expect(actor.getSnapshot().matches({ view: "immersive" })).toBe(true);
    expect(document.documentElement.dataset.view).toBe("immersive");

    actor.send({ type: "TOGGLE_FULLSCREEN" });
    expect(actor.getSnapshot().matches({ view: "normal" })).toBe(true);
    expect(document.documentElement.dataset.view).toBeUndefined();
  });

  it("follows the browser when it leaves full screen on its own", async () => {
    const actor = start();
    await settle();
    actor.send({ type: "TOGGLE_FULLSCREEN" });

    actor.send({ type: "FULLSCREEN_EXITED" });

    expect(actor.getSnapshot().matches({ view: "normal" })).toBe(true);
    expect(document.documentElement.dataset.view).toBeUndefined();
  });

  it("leaveFullscreen clears immersive, for the chamber's unmount", async () => {
    const actor = start();
    await settle();
    actor.send({ type: "TOGGLE_FULLSCREEN" });
    actor.stop(); // an actor stopping runs no exit actions…

    leaveFullscreen(); // …so the component calls this on unmount

    expect(document.documentElement.dataset.view).toBeUndefined();
  });

  it("does not depend on the document having loaded", () => {
    const actor = start();
    actor.send({ type: "TOGGLE_FULLSCREEN" });
    expect(actor.getSnapshot().matches({ view: "immersive", document: "loading" })).toBe(true);
  });
});
