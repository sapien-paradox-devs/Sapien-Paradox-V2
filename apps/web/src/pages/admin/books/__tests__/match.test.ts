import { describe, expect, it } from "vitest";

import { numberIn, planChapters, planVideos, titleFrom } from "../match";

const files = (...names: string[]) => names.map((name) => ({ name }));

describe("titleFrom (D86)", () => {
  it.each([
    ["ch1_the_long_descent.pdf", "The long descent"],
    ["Chapter 2 - Clocks.pdf", "Clocks"],
    ["10 Return.pdf", "Return"],
    ["01. Of Ink and Time.pdf", "Of Ink and Time"],
    ["Part 3: Silence.pdf", "Silence"],
    ["Preface.pdf", "Preface"],
    ["07.pdf", "07"],
  ])("%s → %s", (name, title) => {
    expect(titleFrom(name)).toBe(title);
  });
});

describe("numberIn", () => {
  it("reads the first number, or none", () => {
    expect(numberIn("ch12_x.pdf")).toBe(12);
    expect(numberIn("Preface.pdf")).toBeNull();
  });
});

describe("planChapters (D86)", () => {
  it("orders by the number in the name, not the text", () => {
    const plan = planChapters(files("10 Return.pdf", "Chapter 2 - Clocks.pdf", "ch1_descent.pdf"));
    expect(plan.chapters.map((c) => c.title)).toEqual(["Descent", "Clocks", "Return"]);
  });

  it("falls back to natural order, numbered files first", () => {
    const plan = planChapters(files("Epilogue.pdf", "Afterword.pdf", "1 Start.pdf"));
    expect(plan.chapters.map((c) => c.title)).toEqual(["Start", "Afterword", "Epilogue"]);
  });

  it("lists non-PDFs as skipped and ignores hidden files", () => {
    const plan = planChapters(files("1.pdf", "notes.docx", ".DS_Store", "._1.pdf", "cover.jpg"));
    expect(plan.chapters).toHaveLength(1);
    expect(plan.skipped.map((f) => f.name)).toEqual(["notes.docx", "cover.jpg"]);
  });

  it("reads files from inside a dropped folder path", () => {
    const plan = planChapters(files("book/2 Two.pdf", "book/1 One.pdf"));
    expect(plan.chapters.map((c) => c.title)).toEqual(["One", "Two"]);
  });
});

describe("planVideos (D86)", () => {
  const chapters = [
    { id: "a", number: 1, title: "The Descent" },
    { id: "b", number: 2, title: "Clocks" },
    { id: "c", number: 3, title: "Return" },
  ];

  it("matches by number, then by title, and finds the sample", () => {
    const plan = planVideos(files("2-clocks.mp4", "Return.mp4", "sample.mp4", "intro.mp4"), chapters);
    expect(plan.matches).toEqual([
      { file: { name: "2-clocks.mp4" }, chapterId: "b" },
      { file: { name: "Return.mp4" }, chapterId: "c" },
    ]);
    expect(plan.sample).toEqual({ name: "sample.mp4" });
    expect(plan.tray.map((f) => f.name)).toEqual(["intro.mp4"]);
  });

  it("sends an ambiguous number to the tray rather than guessing", () => {
    const plan = planVideos(files("1 a.mp4", "1 b.mp4"), chapters);
    expect(plan.matches).toEqual([]);
    expect(plan.tray).toHaveLength(2);
  });

  it("never gives one chapter two videos", () => {
    const plan = planVideos(files("2.mp4", "Clocks.mp4"), chapters);
    expect(plan.matches).toHaveLength(1);
    expect(plan.tray).toHaveLength(1);
  });

  it("skips what is not an MP4", () => {
    expect(planVideos(files("1.mov"), chapters).skipped).toHaveLength(1);
  });
});
