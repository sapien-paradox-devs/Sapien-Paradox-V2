import { describe, expect, it, vi } from "vitest";

import { ChapterList } from "../ChapterList";
import type { Book } from "../ChapterList";
import { renderToContainer } from "./render";

const BOOKS: Book[] = [
  {
    id: "b1",
    title: "The Sapien Paradox",
    chapters: [
      { id: "c1", number: 1, title: "The Long Descent", read: false },
      { id: "c2", number: 2, title: "The Long Ascent", read: true },
    ],
  },
];

describe("ChapterList", () => {
  it("opens the chapter that was clicked", () => {
    const onOpen = vi.fn();
    const { container, unmount } = renderToContainer(
      <ChapterList books={BOOKS} sendingChapterId={null} onOpen={onOpen} onSend={() => {}} />,
    );

    container.querySelector<HTMLButtonElement>(".chapter-row-open")?.click();

    expect(onOpen).toHaveBeenCalledWith("c1");
    unmount();
  });

  it("marks a read chapter with a quiet mark, not a progress bar", () => {
    const { container, unmount } = renderToContainer(
      <ChapterList books={BOOKS} sendingChapterId={null} onOpen={() => {}} onSend={() => {}} />,
    );

    const rows = container.querySelectorAll(".chapter-row");

    expect(rows[0].querySelector(".chapter-row-mark")).toBeNull();
    expect(rows[1].querySelector(".chapter-row-mark")).not.toBeNull();
    unmount();
  });

  it("asks to send the chapter that was clicked", () => {
    const onSend = vi.fn();
    const { container, unmount } = renderToContainer(
      <ChapterList books={BOOKS} sendingChapterId={null} onOpen={() => {}} onSend={onSend} />,
    );

    const rows = container.querySelectorAll(".chapter-row");
    rows[1].querySelectorAll("button")[1]?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );

    expect(onSend).toHaveBeenCalledWith("c2");
    unmount();
  });

  it("disables the send button only for the chapter in flight", () => {
    const { container, unmount } = renderToContainer(
      <ChapterList
        books={BOOKS}
        sendingChapterId="c1"
        onOpen={() => {}}
        onSend={() => {}}
      />,
    );

    const rows = container.querySelectorAll(".chapter-row");

    expect(rows[0].querySelectorAll("button")[1]?.hasAttribute("disabled")).toBe(true);
    expect(rows[1].querySelectorAll("button")[1]?.hasAttribute("disabled")).toBe(false);
    unmount();
  });
});
