import type { Event } from "./types";

export const hasTitle = ({ event }: { event: Event }) =>
  event.type === "SUBMIT" && event.book.title.trim().length > 0;
