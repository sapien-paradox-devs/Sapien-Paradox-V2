import { describe, expect, it } from "vitest";
import { createActor, fromPromise } from "xstate";

import { navigationMachine } from "..";
import type { User } from "../types";

const READER: User = {
  id: "1",
  fullName: "Ada",
  email: "ada@example.com",
  phone: "+919876543210",
  isStaff: false,
};

/** Stubs the two actors so no test touches the network. */
function start(options: { session?: "ok" | "401"; logout?: "ok" | "fail" } = {}) {
  const machine = navigationMachine.provide({
    actors: {
      checkSession: fromPromise<User>(async () => {
        if (options.session === "ok") return READER;
        throw new Error("401");
      }),
      logoutActor: fromPromise<void>(async () => {
        if (options.logout === "fail") throw new Error("network");
      }),
    },
  });

  const actor = createActor(machine).start();
  return actor;
}

function route(actor: ReturnType<typeof start>, path: string) {
  actor.send({ type: "ROUTE", path });
  return actor.getSnapshot();
}

describe("the page region", () => {
  it("routes /begin to its own page (#160)", () => {
    const snapshot = route(start(), "/begin");
    expect(snapshot.matches({ page: "begin" })).toBe(true);
  });

  it("starts in unknown, so Home never flashes before the first ROUTE", () => {
    expect(start().getSnapshot().matches({ page: "unknown" })).toBe(true);
  });

  it("sends a token link to the reader", () => {
    expect(route(start(), "/r/abc123").matches({ page: "reader" })).toBe(true);
  });

  it("sends a set-password link to the reset page", () => {
    expect(route(start(), "/reset/tok_123").matches({ page: "reset" })).toBe(true);
  });

  it("does not mistake the reset link for home", () => {
    // Before the reset page existed this fell through to `.page.home`, which
    // showed a signed-out reader the landing page instead of the form (D26).
    expect(route(start(), "/reset/tok_123").matches({ page: "home" })).toBe(false);
  });

  it("sends /login to login", () => {
    expect(route(start(), "/login").matches({ page: "login" })).toBe(true);
  });

  it("sends /read/:chapterId to opening", () => {
    expect(route(start(), "/read/7").matches({ page: "opening" })).toBe(true);
  });

  it("sends / to home", () => {
    expect(route(start(), "/").matches({ page: "home" })).toBe(true);
  });

  it("sends /admin/login to its own page, not the admin (D82)", () => {
    expect(route(start(), "/admin/login").matches({ page: "adminLogin" })).toBe(true);
  });

  it("sends /admin and everything under it to the admin (D82)", () => {
    for (const path of ["/admin", "/admin/readers", "/admin/readers/7"]) {
      expect(route(start(), path).matches({ page: "admin" })).toBe(true);
    }
  });

  it("does not mistake a path that merely starts with 'admin' for the admin", () => {
    expect(route(start(), "/administration").matches({ page: "home" })).toBe(true);
  });

  it("falls unrecognised paths through to home rather than a 404", () => {
    expect(route(start(), "/nothing/here").matches({ page: "home" })).toBe(true);
  });
});

describe("changing page leaves the session alone (#193)", () => {
  it("does not restart the session check on ROUTE", async () => {
    let checks = 0;
    const machine = navigationMachine.provide({
      actors: {
        checkSession: fromPromise<User>(async () => {
          checks += 1;
          return READER;
        }),
        logoutActor: fromPromise<void>(async () => {}),
      },
    });
    const actor = createActor(machine).start();
    await new Promise((r) => setTimeout(r, 0));

    for (const path of ["/", "/login", "/admin", "/r/abc", "/"]) actor.send({ type: "ROUTE", path });
    await new Promise((r) => setTimeout(r, 0));

    expect(checks).toBe(1);
    expect(actor.getSnapshot().matches({ session: "authenticated" })).toBe(true);
  });

  it("keeps a sign-in that arrives just before the page changes", () => {
    const actor = start({ session: "401" });
    return new Promise<void>((resolve) => setTimeout(() => {
      actor.send({ type: "AUTHENTICATED", user: READER });
      actor.send({ type: "ROUTE", path: "/" });
      expect(actor.getSnapshot().matches({ session: "authenticated", page: "home" })).toBe(true);
      expect(actor.getSnapshot().context.user).toEqual(READER);
      resolve();
    }, 0));
  });
});

describe("the session region", () => {
  it("reaches authenticated when the boot check succeeds", async () => {
    const actor = start({ session: "ok" });
    await settle();

    expect(actor.getSnapshot().matches({ session: "authenticated" })).toBe(true);
    expect(actor.getSnapshot().context.user).toEqual(READER);
  });

  it("reaches anonymous when the boot check 401s", async () => {
    const actor = start();
    await settle();

    expect(actor.getSnapshot().matches({ session: "anonymous" })).toBe(true);
  });

  it("clears the session even when logout fails", async () => {
    const actor = start({ session: "ok", logout: "fail" });
    await settle();

    actor.send({ type: "LOGOUT" });
    await settle();

    expect(actor.getSnapshot().matches({ session: "anonymous" })).toBe(true);
    expect(actor.getSnapshot().context.user).toBeNull();
  });
});

describe("the two regions are independent", () => {
  it("allows a token link to render while the session is still checking", () => {
    // Exactly a WhatsApp visitor on a phone with no cookie. If the page region
    // waited on the session region, this link would bounce to /login (D15).
    const snapshot = route(start(), "/r/abc123");

    expect(snapshot.matches({ session: "checking" })).toBe(true);
    expect(snapshot.matches({ page: "reader" })).toBe(true);
  });

  it("keeps the root context to one field", () => {
    expect(Object.keys(start().getSnapshot().context)).toEqual(["user"]);
  });
});

/** Lets the invoked promise actors resolve. */
function settle() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
