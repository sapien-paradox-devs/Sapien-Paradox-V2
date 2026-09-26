import { describe, expect, it } from "vitest";
import { createActor, fromPromise } from "xstate";

import { ApiError } from "../../../../lib/fetcher";
import type { User } from "../../../machine";
import type { Credentials } from "../actors";
import { loginMachine } from "..";

const READER: User = {
  id: "1",
  fullName: "Ada",
  email: "ada@example.com",
  phone: "+919876543210",
  avatarSeed: null,
  isStaff: false,
};

function start(outcome: "ok" | 401 | 500 = "ok") {
  const machine = loginMachine.provide({
    actors: {
      loginActor: fromPromise<User, Credentials>(async () => {
        if (outcome === "ok") return READER;
        throw new ApiError(outcome, null);
      }),
    },
  });
  return createActor(machine).start();
}

const settle = () => new Promise((r) => setTimeout(r, 0));
const credentials = { type: "SUBMIT", email: "ada@example.com", password: "pw" } as const;

describe("the login machine", () => {
  it("carries the reader out on success", async () => {
    const actor = start();

    actor.send(credentials);
    await settle();

    expect(actor.getSnapshot().context.user).toEqual(READER);
  });

  it("says a wrong password is a wrong password", async () => {
    const actor = start(401);

    actor.send(credentials);
    await settle();

    expect(actor.getSnapshot().matches("error")).toBe(true);
    expect(actor.getSnapshot().context.errorMessage).toMatch(/do not match/i);
  });

  it("distinguishes an outage from a wrong password", async () => {
    const actor = start(500);

    actor.send(credentials);
    await settle();

    expect(actor.getSnapshot().context.errorMessage).toMatch(/could not reach/i);
  });

  it("clears the error as soon as the reader starts correcting it", async () => {
    const actor = start(401);
    actor.send(credentials);
    await settle();

    actor.send({ type: "EDIT" });

    expect(actor.getSnapshot().matches("idle")).toBe(true);
    expect(actor.getSnapshot().context.errorMessage).toBeNull();
  });

  it("does not call the API with an empty field", () => {
    const actor = start();

    actor.send({ type: "SUBMIT", email: "", password: "pw" });

    expect(actor.getSnapshot().matches("idle")).toBe(true);
  });

  it("allows a second attempt after a failure", async () => {
    const actor = start(401);
    actor.send(credentials);
    await settle();

    actor.send(credentials);

    expect(actor.getSnapshot().matches("submitting")).toBe(true);
  });
});
