import { describe, expect, it } from "vitest";

import { headerContents } from "../contents";

describe("headerContents", () => {
  it("hides on pages that redirect or have not resolved yet", () => {
    expect(headerContents("opening", true).hidden).toBe(true);
    expect(headerContents("unknown", false).hidden).toBe(true);
  });

  it("gives the library its account controls and no link to itself", () => {
    expect(headerContents("library", true)).toEqual({
      hidden: false,
      library: false,
      account: true,
      signIn: false,
    });
  });

  it("offers sign in on the landing page", () => {
    expect(headerContents("landing", false).signIn).toBe(true);
  });

  it("gives a signed-in reader the way back from the chamber", () => {
    expect(headerContents("reader", true).library).toBe(true);
  });

  it("does not push an anonymous WhatsApp visitor towards signing in", () => {
    expect(headerContents("reader", false)).toEqual({
      hidden: false,
      library: false,
      account: false,
      signIn: false,
    });
  });

  it.each(["login", "reset", "welcome"] as const)("shows only the wordmark on %s", (page) => {
    expect(headerContents(page, false)).toEqual({
      hidden: false,
      library: false,
      account: false,
      signIn: false,
    });
  });
});
