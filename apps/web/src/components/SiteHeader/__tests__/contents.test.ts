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
      signUp: false,
    });
  });

  it("offers sign in on the landing page", () => {
    expect(headerContents("landing", false).signIn).toBe(true);
  });

  it("offers sign in on /begin, like the landing page (#160)", () => {
    expect(headerContents("begin", false).signIn).toBe(true);
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
      signUp: false,
    });
  });

  it("offers sign up beside sign in on the landing page (#205)", () => {
    expect(headerContents("landing", false)).toMatchObject({ signIn: true, signUp: true });
  });

  it("offers sign up on the sign-in page, and sign in on the sign-up page (#205)", () => {
    expect(headerContents("login", false)).toMatchObject({ signIn: false, signUp: true });
    expect(headerContents("begin", false)).toMatchObject({ signIn: true, signUp: false });
  });

  it("gives the profile page a library link and account controls", () => {
    expect(headerContents("profile", true)).toEqual({
      hidden: false,
      library: true,
      account: true,
      signIn: false,
      signUp: false,
    });
  });

  it.each(["reset", "welcome"] as const)("shows only the wordmark on %s", (page) => {
    expect(headerContents(page, false)).toEqual({
      hidden: false,
      library: false,
      account: false,
      signIn: false,
      signUp: false,
    });
  });
});
