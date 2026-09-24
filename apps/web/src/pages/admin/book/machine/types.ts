import type { BookDetail, Refusal } from "../../types";

export type Details = { title: string; author: string; description: string; priceMinorUnits: number };

/** One change to the book or a chapter. Each is a single request that returns the book. */
export type Op =
  | { kind: "details"; details: Details }
  | { kind: "rename"; chapterId: string; title: string }
  | { kind: "reorder"; chapterIds: string[] }
  | { kind: "deleteChapter"; chapterId: string }
  | { kind: "retryChapter"; chapterId: string }
  | { kind: "removeChapterVideo"; chapterId: string }
  | { kind: "removeMedia"; which: "cover" | "video" | "sample" }
  | { kind: "publish" }
  | { kind: "unpublish" };

export type Context = {
  id: string;
  book: BookDetail | null;
  refusal: Refusal | null;
  /** The op in flight, so the screen can show which row is busy. */
  op: Op | null;
};

export type Event =
  | { type: "RETRY" }
  | { type: "RUN"; op: Op }
  | { type: "DISMISS_REFUSAL" };
