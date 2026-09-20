import { describe, expect, it } from "vitest";
import { createActor, fromPromise } from "xstate";

import { ApiError } from "../../../../lib/fetcher";
import type { Outcome, ResendOutcome } from "../types";
import { welcomeMachine } from "..";

function start(outcome: Outcome | ApiError, resend?: ResendOutcome | ApiError) {
  const machine = welcomeMachine.provide({
    actors: {
      confirmActor: fromPromise<Outcome, void>(async () => {
        if (outcome instanceof ApiError) throw outcome;
        return outcome;
      }),
      resendActor: fromPromise<ResendOutcome, void>(async () => {
        if (resend instanceof ApiError) throw resend;
        return resend ?? { status: "sent", chapterSent: true, passwordSent: true, detail: "" };
      }),
    },
  });
  return createActor(machine).start();
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe("the welcome machine", () => {
  it("lands on fulfilled when the redirect created the reader", async () => {
    const actor = start({ status: "fulfilled", delivered: true, detail: "" });
    await settle();

    expect(actor.getSnapshot().matches("fulfilled")).toBe(true);
    expect(actor.getSnapshot().context.delivered).toBe(true);
  });

  it("separates fulfilled-and-delivered from fulfilled-but-not", async () => {
    // Twilio refusing the message is not the purchase failing, and the page must
    // not say the chapter is on its way when it never left.
    const actor = start({ status: "fulfilled", delivered: false, detail: "" });
    await settle();

    expect(actor.getSnapshot().matches("fulfilled")).toBe(true);
    expect(actor.getSnapshot().context.delivered).toBe(false);
  });

  it("treats an unpaid link as pending, not as a failure", async () => {
    const actor = start({ status: "pending", delivered: false, detail: "" });
    await settle();

    expect(actor.getSnapshot().matches("pending")).toBe(true);
  });

  it("carries the refusal reason so the page can explain it", async () => {
    const actor = start({ status: "refused", delivered: false, detail: "already_owns_book" });
    await settle();

    expect(actor.getSnapshot().matches("refused")).toBe(true);
    expect(actor.getSnapshot().context.detail).toBe("already_owns_book");
  });

  it("falls to failed when the call itself breaks", async () => {
    const actor = start(new ApiError(502, null));
    await settle();

    expect(actor.getSnapshot().matches("failed")).toBe(true);
  });

  it("lets a reader ask for the messages again without paying again", async () => {
    const actor = start({ status: "fulfilled", delivered: false, detail: "" });
    await settle();

    actor.send({ type: "RESEND" });
    await settle();

    expect(actor.getSnapshot().matches("resent")).toBe(true);
    expect(actor.getSnapshot().context.resend?.chapterSent).toBe(true);
  });

  it("reports a throttled resend as its own outcome, not a failure", async () => {
    const actor = start(
      { status: "fulfilled", delivered: true, detail: "" },
      { status: "throttled", chapterSent: false, passwordSent: false, detail: "" },
    );
    await settle();

    actor.send({ type: "RESEND" });
    await settle();

    expect(actor.getSnapshot().context.resend?.status).toBe("throttled");
  });

  it("offers a retry from pending too, where the reader is also still waiting", async () => {
    const actor = start({ status: "pending", delivered: false, detail: "" });
    await settle();

    actor.send({ type: "RESEND" });

    expect(actor.getSnapshot().matches("resending")).toBe(true);
  });

  it("does not offer one from a refusal, where sending again cannot help", async () => {
    const actor = start({ status: "refused", delivered: false, detail: "already_owns_book" });
    await settle();

    actor.send({ type: "RESEND" });

    expect(actor.getSnapshot().matches("refused")).toBe(true);
  });

  it("survives the resend call itself failing", async () => {
    const actor = start({ status: "fulfilled", delivered: false, detail: "" }, new ApiError(502, null));
    await settle();

    actor.send({ type: "RESEND" });
    await settle();

    expect(actor.getSnapshot().matches("resent")).toBe(true);
    expect(actor.getSnapshot().context.resend?.chapterSent).toBe(false);
  });
});
