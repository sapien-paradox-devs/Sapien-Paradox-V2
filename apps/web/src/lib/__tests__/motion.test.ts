import { afterEach, describe, expect, it, vi } from "vitest";

import { parseDuration, transition } from "../motion";

/** A stand-in for the browser API: runs the callback at once and resolves. */
function stubViewTransitions() {
  const start = vi.fn((update: () => void) => {
    update();
    return { finished: Promise.resolve() };
  });
  Object.defineProperty(document, "startViewTransition", { value: start, configurable: true });
  return start;
}

afterEach(() => {
  // jsdom has no startViewTransition of its own; remove the stub.
  Reflect.deleteProperty(document, "startViewTransition");
  delete document.documentElement.dataset.transition;
});

describe("transition", () => {
  it("applies the update directly where the browser has no view transitions", () => {
    const update = vi.fn();
    transition(update, { kind: "page" });
    expect(update).toHaveBeenCalledOnce();
  });

  it("runs the update inside a view transition where there is one", () => {
    const start = stubViewTransitions();
    const update = vi.fn();
    transition(update, { kind: "page" });
    expect(start).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledOnce();
  });

  it("marks what kind of change is running, then clears it", async () => {
    stubViewTransitions();
    let during: string | undefined;
    transition(() => (during = document.documentElement.dataset.transition), { kind: "theme" });
    expect(during).toBe("theme");
    await Promise.resolve();
    await Promise.resolve();
    expect(document.documentElement.dataset.transition).toBeUndefined();
  });

  it("skips the transition when the browser already animated a back swipe", () => {
    const start = stubViewTransitions();
    const update = vi.fn();
    transition(update, { kind: "page", skip: true });
    expect(start).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledOnce();
  });
});

describe("parseDuration", () => {
  it("reads the units a CSS duration token can carry", () => {
    expect(parseDuration("650ms")).toBe(650);
    expect(parseDuration(" 0.2s ")).toBe(200);
  });

  it("refuses anything else, so the caller falls back", () => {
    expect(parseDuration("")).toBeNull();
    expect(parseDuration("fast")).toBeNull();
    expect(parseDuration("650")).toBeNull();
  });
});
