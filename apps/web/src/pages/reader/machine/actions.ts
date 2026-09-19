import type { AnyEventObject } from "xstate";

import type { ChapterMeta, Context } from "./types";

export function chapterFrom({
  event,
}: {
  event: AnyEventObject;
}): Pick<Context, "chapter"> {
  const output = "output" in event ? event.output : null;
  return { chapter: isChapter(output) ? output : null };
}

function isChapter(value: unknown): value is ChapterMeta {
  return typeof value === "object" && value !== null && "title" in value;
}
