import { describe, expect, it } from "vitest";

import { arrivalDates } from "../HowItWorks";

describe("arrivalDates", () => {
  const start = new Date(2026, 8, 23); // 23 Sep 2026

  it("starts today and steps by the pace's interval", () => {
    const days = arrivalDates(start, 3, 3).map((d) => d.getDate());
    expect(days).toEqual([23, 26, 29]);
  });

  it("crosses a month boundary", () => {
    const [, second] = arrivalDates(start, 7, 2);
    expect(second.getMonth()).toBe(8);
    expect(second.getDate()).toBe(30);
    expect(arrivalDates(start, 7, 3)[2].getMonth()).toBe(9);
  });

  it("returns nothing for a book with no chapters", () => {
    expect(arrivalDates(start, 1, 0)).toEqual([]);
  });
});
