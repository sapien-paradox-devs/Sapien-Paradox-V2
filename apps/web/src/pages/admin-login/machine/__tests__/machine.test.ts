import { describe, expect, it } from "vitest";
import { createActor, fromPromise } from "xstate";

import { ApiError } from "../../../../lib/fetcher";
import type { User } from "../../../machine";
import type { Credentials } from "../../../login/machine/actors";
import { adminLoginMachine } from "..";

const person = (isStaff: boolean): User => ({
  id: "1", fullName: "Owner", email: "owner@example.com", phone: "+919876543210", isStaff,
});

function start(outcome: "staff" | "reader" | 401 | 500) {
  const machine = adminLoginMachine.provide({
    actors: {
      loginActor: fromPromise<User, Credentials>(async () => {
        if (outcome === "staff") return person(true);
        if (outcome === "reader") return person(false);
        throw new ApiError(outcome, null);
      }),
    },
  });
  return createActor(machine).start();
}

const settle = () => new Promise((r) => setTimeout(r, 0));
const submit = { type: "SUBMIT", email: "owner@example.com", password: "pw" } as const;

describe("the admin login machine (D82)", () => {
  it("carries a staff account out", async () => {
    const actor = start("staff");
    actor.send(submit);
    await settle();
    expect(actor.getSnapshot().status).toBe("done");
    expect(actor.getSnapshot().context.user?.isStaff).toBe(true);
  });

  it("stops a reader account at notStaff and carries nobody out", async () => {
    const actor = start("reader");
    actor.send(submit);
    await settle();
    expect(actor.getSnapshot().matches("notStaff")).toBe(true);
    expect(actor.getSnapshot().context.user).toBeNull();
  });

  it("says a wrong password is a wrong password", async () => {
    const actor = start(401);
    actor.send(submit);
    await settle();
    expect(actor.getSnapshot().matches("error")).toBe(true);
  });

  it("does not submit empty fields", () => {
    const actor = start("staff");
    actor.send({ type: "SUBMIT", email: " ", password: "" });
    expect(actor.getSnapshot().matches("idle")).toBe(true);
  });
});
