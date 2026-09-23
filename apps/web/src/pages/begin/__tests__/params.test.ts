import { describe, expect, it } from "vitest";

import { bookFrom, paceFrom } from "../params";

const BOOKS = [
  { slug: "first", title: "First", priceMinorUnits: 100, chapterCount: 5 },
  { slug: "second", title: "Second", priceMinorUnits: 200, chapterCount: 7 },
];

describe("paceFrom", () => {
  it("keeps the pace the landing page chose", () => {
    expect(paceFrom("slow")).toBe("slow");
    expect(paceFrom("fast")).toBe("fast");
  });

  it("falls back to steady for anything else", () => {
    expect(paceFrom(null)).toBe("medium");
    expect(paceFrom("sprint")).toBe("medium");
  });
});

describe("bookFrom", () => {
  it("sells the book the link asked for (the catalogue's Buy, D79)", () => {
    expect(bookFrom(BOOKS, "second")?.title).toBe("Second");
  });

  it("sells the first book when none, or an unknown one, is named", () => {
    expect(bookFrom(BOOKS, null)?.title).toBe("First");
    expect(bookFrom(BOOKS, "gone")?.title).toBe("First");
  });

  it("has nothing to sell when nothing is on sale", () => {
    expect(bookFrom([], "first")).toBeNull();
  });
});
