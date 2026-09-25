import { describe, expect, it } from "vitest";

import { numberIn, planChapters, titleFrom } from "../match";

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
