import type { AnyEventObject } from "xstate";

import type { ReaderRow } from "../../types";
import type { Context, Event } from "./types";

export function searchFrom({ event }: { event: Event }): Pick<Context, "search"> {
  return { search: event.type === "SEARCH" ? event.search : "" };
}

export function statusFrom({ event }: { event: Event }): Pick<Context, "status"> {
  return { status: event.type === "STATUS" ? event.status : "all" };
}

export function readersFrom({ event }: { event: AnyEventObject }): Pick<Context, "readers"> {
  const output = "output" in event ? event.output : null;
  return { readers: Array.isArray(output) ? output.filter(isRow) : [] };
}

function isRow(value: unknown): value is ReaderRow {
  return typeof value === "object" && value !== null && "email" in value && "isActive" in value;
}
