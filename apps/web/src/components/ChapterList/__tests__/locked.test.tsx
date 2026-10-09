// @vitest-environment jsdom
/**
 * A locked chapter is a row with a date and no way to press it (#114).
 *
 * The claim worth a DOM test is the absence: cadence refuses `/read` and
 * `/send` for a scheduled chapter, so a row that offered either would hand the
 * reader a 409. One rendered list, counted both ways.
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ChapterList, type ChapterRowData } from "..";
import { labels } from "../../../lib/labels";

const ARRIVED: ChapterRowData = {
  id: "1",
  number: 1,
  title: "The Descent",
  read: true,
  progress: 0.4,
  completed: false,
  locked: false,
  unlocksAt: null,
};

const TO_COME: ChapterRowData = {
  id: "2",
  number: 2,
  title: "Clocks and Calendars",
  read: false,
  progress: 0,
  completed: false,
  locked: true,
  unlocksAt: "2026-10-17T08:00:00+05:30",
};

let container: HTMLDivElement;
let root: Root;

function render(chapters: ChapterRowData[]) {
  act(() => {
    root.render(
      <ChapterList
        chapters={chapters}
        sendingChapterId={null}
        onOpen={() => {}}
        onSend={() => {}}
      />,
    );
  });
}

beforeEach(() => {
  // React only accepts `act` when the environment says it is a test one.
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  act(() => {
    root = createRoot(container);
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("a locked chapter row", () => {
  it("is listed, so the reader can see the shape of the book", () => {
    render([ARRIVED, TO_COME]);

    expect(container.querySelectorAll("li")).toHaveLength(2);
    expect(container.textContent).toContain("Clocks and Calendars");
  });

  it("offers nothing to press — not even a disabled button", () => {
    render([TO_COME]);

    expect(container.querySelectorAll("button")).toHaveLength(0);
  });

  it("an arrived chapter keeps its link and its send button", () => {
    render([ARRIVED]);

    expect(container.querySelector(".ui-chapter-open")).not.toBeNull();
    expect(container.querySelectorAll("button").length).toBeGreaterThan(1);
  });

  it("says the day it opens, not how long is left", () => {
    render([TO_COME]);

    const when = container.querySelector(".ui-chapter-when")?.textContent ?? "";
    expect(when).toContain(labels.home.unlocks.trim());
    expect(when).toContain("17");
    expect(when).toContain("Oct");
    expect(when).not.toMatch(/day|hour|minute/i);
  });

  it("names the lock for a screen reader, since the date is beside the title", () => {
    render([TO_COME]);

    const label = container.querySelector(".ui-chapter-locked")?.getAttribute("aria-label") ?? "";
    expect(label).toContain(labels.home.lockedAria.trim());
  });

  /* The schedule always has a date, but a row must not render "Invalid Date". */
  it("falls back to words when a locked row has no date", () => {
    render([{ ...TO_COME, unlocksAt: null }]);

    expect(container.textContent).toContain(labels.home.locked);
  });
});
