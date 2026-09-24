import type { AnyEventObject } from "xstate";

import { refusalOf } from "../../refusal";
import type { BookDetail } from "../../types";
import type { Context, Event } from "./types";

export function bookFrom({ event }: { event: AnyEventObject }): Partial<Context> {
  const output = "output" in event ? event.output : null;
  return isBook(output) ? { book: output } : {};
}

export function opFrom({ event }: { event: Event }): Pick<Context, "op"> {
  return { op: event.type === "RUN" ? event.op : null };
}

export function clearOp(): Pick<Context, "op"> {
  return { op: null };
}

export function opRefusal({ event }: { event: AnyEventObject }): Pick<Context, "refusal"> {
  return { refusal: refusalOf(event) ?? { code: "failed", field: null } };
}

export function clearRefusal(): Pick<Context, "refusal"> {
  return { refusal: null };
}

function isBook(value: unknown): value is BookDetail {
  return typeof value === "object" && value !== null && "chapters" in value && "checklist" in value;
}
