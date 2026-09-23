import { describe, expect, it } from "vitest";
import { createActor, fromPromise } from "xstate";

import { ApiError } from "../../../../lib/fetcher";
import { pdfMachine } from "..";
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

    expect(actor.getSnapshot().matches("rendered")).toBe(true);
    expect(actor.getSnapshot().context.layout).toEqual(LAYOUT);
  });

  it("keeps its own error when the pages fail, and retries (D43)", async () => {
    const actor = start(500);
    await settle();
    expect(actor.getSnapshot().matches("error")).toBe(true);

    actor.send({ type: "RETRY" });
    await settle();
    expect(actor.getSnapshot().matches("rendered")).toBe(true);
  });

  it("treats a chapter that is not rendered yet as its own error, not sanctuary", async () => {
    const actor = start(404);
    await settle();

    expect(actor.getSnapshot().matches("error")).toBe(true);
  });
});
