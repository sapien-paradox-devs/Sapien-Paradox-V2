import type { AnyEventObject } from "xstate";

import type { Context, Layout } from "./types";

export function layoutFrom({ event }: { event: AnyEventObject }): Pick<Context, "layout"> {
  const output = "output" in event ? event.output : null;
  return { layout: isLayout(output) ? output : null };
}

function isLayout(value: unknown): value is Layout {
  return (
    typeof value === "object" &&
    value !== null &&
    "pages" in value &&
    Array.isArray(value.pages) &&
    "sections" in value &&
    Array.isArray(value.sections)
  );
}
