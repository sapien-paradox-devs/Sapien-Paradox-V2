import { describe, expect, it } from "vitest";

import { nextSendDelay } from "../useProgressSync";

describe("nextSendDelay (D70)", () => {
  it("waits for scrolling to settle", () => {
    expect(nextSendDelay(100_000, 0)).toBe(1500);
  });

  it("never sends more often than every five seconds", () => {
    expect(nextSendDelay(10_000, 9_000)).toBe(4000);
    expect(nextSendDelay(10_000, 6_000)).toBe(1500);
  });
});
