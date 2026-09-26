import { describe, expect, it } from "vitest";
import { createActor, fromPromise } from "xstate";

import { ApiError } from "../../../../lib/fetcher";
import { profileMachine } from "..";
import type { SaveInput, PasswordInput } from "../actors";
import type { Profile } from "../types";

const PROFILE: Profile = {
  fullName: "Ada Demo",
  email: "ada@example.com",
  phone: "+919000000000",
  hasPassword: true,
  avatarSeed: null,
  books: [{ title: "The Book", chaptersUnlocked: 1, chaptersTotal: 3, progress: 0.33 }],
};

function start(
  fetchResult: Profile | Error = PROFILE,
  saveResult: Profile | Error = { ...PROFILE, fullName: "Ada Updated" },
  passwordResult: void | Error = undefined,
) {
  const machine = profileMachine.provide({
    actors: {
      fetchProfile: fromPromise<Profile>(async () => {
        if (fetchResult instanceof Error) throw fetchResult;
        return fetchResult;
      }),
      saveProfile: fromPromise<Profile, SaveInput>(async () => {
        if (saveResult instanceof Error) throw saveResult;
        return saveResult as Profile;
      }),
      changePassword: fromPromise<void, PasswordInput>(async () => {
        if (passwordResult instanceof Error) throw passwordResult;
      }),
    },
  });
  return createActor(machine).start();
}

describe("data region", () => {
  it("loads the profile on start", async () => {
    const actor = start();
    await new Promise((r) => setTimeout(r, 0));
    expect(actor.getSnapshot().matches({ data: "ready" })).toBe(true);
    expect(actor.getSnapshot().context.profile?.fullName).toBe("Ada Demo");
  });

  it("enters error on fetch failure", async () => {
    const actor = start(new Error("fail"));
    await new Promise((r) => setTimeout(r, 0));
    expect(actor.getSnapshot().matches({ data: "error" })).toBe(true);
  });

  it("retries from error", async () => {
    const actor = start(new Error("fail"));
    await new Promise((r) => setTimeout(r, 0));
    actor.send({ type: "RETRY" });
    expect(actor.getSnapshot().matches({ data: "loading" })).toBe(true);
  });
});

describe("saving region", () => {
  it("saves profile changes", async () => {
    const actor = start();
    await new Promise((r) => setTimeout(r, 0));
    actor.send({ type: "SAVE", fullName: "Ada Updated" });
    await new Promise((r) => setTimeout(r, 0));
    expect(actor.getSnapshot().matches({ saving: "saved" })).toBe(true);
    expect(actor.getSnapshot().context.profile?.fullName).toBe("Ada Updated");
  });

  it("handles email clash (409)", async () => {
    const actor = start(PROFILE, new ApiError(409, "email_taken"));
    await new Promise((r) => setTimeout(r, 0));
    actor.send({ type: "SAVE", email: "taken@example.com" });
    await new Promise((r) => setTimeout(r, 0));
    expect(actor.getSnapshot().matches({ saving: "failed" })).toBe(true);
    expect(actor.getSnapshot().context.saveError).toBe("email_taken");
  });
});

describe("password region", () => {
  it("changes the password", async () => {
    const actor = start();
    await new Promise((r) => setTimeout(r, 0));
    actor.send({ type: "CHANGE_PASSWORD", currentPassword: "old", newPassword: "newpassword" });
    await new Promise((r) => setTimeout(r, 0));
    expect(actor.getSnapshot().matches({ password: "done" })).toBe(true);
  });

  it("handles wrong password (403)", async () => {
    const actor = start(PROFILE, PROFILE, new ApiError(403, "wrong_password"));
    await new Promise((r) => setTimeout(r, 0));
    actor.send({ type: "CHANGE_PASSWORD", currentPassword: "bad", newPassword: "newpassword" });
    await new Promise((r) => setTimeout(r, 0));
    expect(actor.getSnapshot().matches({ password: "failed" })).toBe(true);
    expect(actor.getSnapshot().context.passwordError).toBe("wrong_password");
  });

  it("handles too-short password (400)", async () => {
    const actor = start(PROFILE, PROFILE, new ApiError(400, "password_too_short"));
    await new Promise((r) => setTimeout(r, 0));
    actor.send({ type: "CHANGE_PASSWORD", newPassword: "short" });
    await new Promise((r) => setTimeout(r, 0));
    expect(actor.getSnapshot().matches({ password: "failed" })).toBe(true);
    expect(actor.getSnapshot().context.passwordError).toBe("too_short");
  });
});
