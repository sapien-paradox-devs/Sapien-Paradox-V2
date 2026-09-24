import type { BookRow } from "../../types";

export type Context = { books: BookRow[] };
export type Event = { type: "RETRY" };
