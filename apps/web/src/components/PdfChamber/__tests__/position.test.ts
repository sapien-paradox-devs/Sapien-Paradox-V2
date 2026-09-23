import { describe, expect, it } from "vitest";

import { activeSection, currentPage, readFraction } from "../position";

describe("readFraction", () => {
  // Pages begin 300px down the document and are 4000px tall; the screen is 800px.
  it("is 0 on arrival, before the reader has scrolled to the pages", () => {
    expect(readFraction(0, 800, 300, 4000)).toBe(0);
  });

  it("is 0 when the first line reaches the top of the screen", () => {
    expect(readFraction(300, 800, 300, 4000)).toBe(0);
  });

  it("is halfway when half the travel is done", () => {
    expect(readFraction(300 + 1600, 800, 300, 4000)).toBe(0.5);
  });

  it("is 1 when the last line reaches the bottom, and never more", () => {
    expect(readFraction(300 + 3200, 800, 300, 4000)).toBe(1);
    expect(readFraction(9000, 800, 300, 4000)).toBe(1);
  });

  it("is 1 for a chapter that fits on one screen", () => {
    expect(readFraction(0, 800, 100, 600)).toBe(1);
  });

  it("is 0 for pages with no height yet", () => {
    expect(readFraction(100, 800, 0, 0)).toBe(0);
  });
});

describe("currentPage", () => {
  const tops = [0, 1000, 2000, 3000];

  it("is the last page whose top is above the probe line", () => {
    expect(currentPage(tops, 0)).toBe(0);
    expect(currentPage(tops, 1500)).toBe(1);
    expect(currentPage(tops, 3000)).toBe(3);
  });
});

describe("activeSection", () => {
  const sections = [
    { title: "Opening", page: 0, depth: 0 },
    { title: "Turn", page: 2, depth: 0 },
    { title: "Close", page: 5, depth: 0 },
  ];

  it("is the last section starting at or before the page", () => {
    expect(activeSection(sections, 0)).toBe(0);
    expect(activeSection(sections, 3)).toBe(1);
    expect(activeSection(sections, 9)).toBe(2);
  });

  it("is -1 before the first section", () => {
    expect(activeSection([{ title: "Late", page: 2, depth: 0 }], 0)).toBe(-1);
  });
});
