import type { AnyEventObject } from "xstate";

import type { Book, Context, Event } from "./types";

export function booksFrom({ event }: { event: AnyEventObject }): Pick<Context, "books"> {
  const output = "output" in event ? event.output : null;

  if (typeof output === "object" && output !== null && "books" in output) {
    const { books } = output;
    return { books: Array.isArray(books) ? (books as Book[]) : [] };
  }
  return { books: [] };
}

export function markSending({ event }: { event: Event }): Pick<Context, "sendingChapterId"> {
  return { sendingChapterId: event.type === "SEND" ? event.chapterId : null };
}

export function clearSending(): Pick<Context, "sendingChapterId"> {
  return { sendingChapterId: null };
}
