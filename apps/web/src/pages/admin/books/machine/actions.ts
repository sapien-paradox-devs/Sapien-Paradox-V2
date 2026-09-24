import type { AnyEventObject } from "xstate";

import type { BookRow } from "../../types";
import type { Context } from "./types";

export function booksFrom({ event }: { event: AnyEventObject }): Pick<Context, "books"> {
  const output = "output" in event ? event.output : null;
  return { books: Array.isArray(output) ? output.filter(isRow) : [] };
}

function isRow(value: unknown): value is BookRow {
  return typeof value === "object" && value !== null && "slug" in value && "isPublished" in value;
}
