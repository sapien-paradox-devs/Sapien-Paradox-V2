import type { AnyEventObject } from "xstate";

import { ApiError } from "../../../lib/fetcher";

export const hasChapters = ({ event }: { event: AnyEventObject }) => {
  const output = "output" in event ? event.output : null;
  return booksOf(output).some(hasAtLeastOneChapter);
};

/**
 * Not a failure. D31 counts limits from existing rows, so hitting one means the
 * reader asked twice and the first one worked (D45).
 */
export const isRateLimited = ({ event }: { event: AnyEventObject }) =>
  "error" in event && event.error instanceof ApiError && event.error.status === 429;

/** `in` narrows, so nothing here needs a cast. */
function booksOf(value: unknown): unknown[] {
  if (typeof value === "object" && value !== null && "books" in value) {
    const { books } = value;
    return Array.isArray(books) ? books : [];
  }
  return [];
}

function hasAtLeastOneChapter(book: unknown): boolean {
  if (typeof book === "object" && book !== null && "chapters" in book) {
    const { chapters } = book;
    return Array.isArray(chapters) && chapters.length > 0;
  }
  return false;
}
