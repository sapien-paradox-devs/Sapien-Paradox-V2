import { describe, expect, it } from "vitest";

import { locale } from "../locale";

describe("locale", () => {
  it("reads a nested string by dot path", () => {
    expect(locale("login.title")).toBe("Welcome back");
  });

  it("throws in development when the key does not exist", () => {
    expect(() => locale("login.doesNotExist")).toThrow(/login\.doesNotExist/);
  });

  it("throws in development when the path resolves to an object, not a string", () => {
    expect(() => locale("login")).toThrow(/"login"/);
  });

  it("throws in development when a segment of the path is not a dictionary", () => {
    expect(() => locale("login.title.nested")).toThrow(/login\.title\.nested/);
  });
});
