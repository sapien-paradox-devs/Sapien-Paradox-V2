import { describe, expect, it } from "vitest";
import { createActor, fromPromise } from "xstate";

import { ApiError } from "../../../../lib/fetcher";
import { openingMachine } from "..";

function start(outcome: "ok" | 403 | 500 = "ok") {
  const machine = openingMachine.provide({
    actors: {
      resolveChapter: fromPromise<{ token: string }, { chapterId: string }>(async () => {
        if (outcome !== "ok") throw new ApiError(outcome, null);
        return { token: "tok_123" };
      }),
    },
  });
  return createActor(machine, { input: { chapterId: "c1" } }).start();
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe("the opening machine", () => {
  it("waits before deciding anything", () => {
    expect(start().getSnapshot().matches("waiting")).toBe(true);
  });

  it("does not bounce a signed-in reader whose session is still checking", async () => {
    // The bug D44 exists to prevent: it appears only on hard refresh, and never
    // in development where the session check resolves instantly.
    const actor = start();
    await settle();

    expect(actor.getSnapshot().matches("anonymous")).toBe(false);
    expect(actor.getSnapshot().matches("waiting")).toBe(true);
  });

  it("resolves a token once the session settles as authenticated", async () => {
    const actor = start();

    actor.send({ type: "SESSION_SETTLED", authenticated: true });
    await settle();

    expect(actor.getSnapshot().context.token).toBe("tok_123");
  });

  it("sends an anonymous visitor to login", () => {
    const actor = start();

    actor.send({ type: "SESSION_SETTLED", authenticated: false });

    expect(actor.getSnapshot().matches("anonymous")).toBe(true);
  });

  it("tells you do not own this book, rather than showing a generic error", async () => {
    const actor = start(403);

    actor.send({ type: "SESSION_SETTLED", authenticated: true });
    await settle();

    expect(actor.getSnapshot().matches("denied")).toBe(true);
  });

  it("offers a retry on a transport failure", async () => {
    const actor = start(500);
    actor.send({ type: "SESSION_SETTLED", authenticated: true });
    await settle();
    expect(actor.getSnapshot().matches("error")).toBe(true);

    actor.send({ type: "RETRY" });

    expect(actor.getSnapshot().matches("resolving")).toBe(true);
  });
});
