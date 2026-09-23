import type { AnyEventObject } from "xstate";

import { refusalOf } from "../../refusal";
import type { ReaderDetail } from "../../types";
import type { Context, Event } from "./types";

export function readerFrom({ event }: { event: AnyEventObject }): Partial<Context> {
  const output = "output" in event ? event.output : null;
  // An action or save that returns nothing leaves the reader as it was.
  return isDetail(output) ? { reader: output } : {};
}

export function refusalFrom({ event }: { event: AnyEventObject }): Pick<Context, "refusal"> {
  return { refusal: refusalOf(event) };
}

/** A save that failed without a refusal code: shown as a form-level message. */
export function failure(): Pick<Context, "refusal"> {
  return { refusal: { code: "failed", field: null } };
}

export function clearRefusal(): Pick<Context, "refusal"> {
  return { refusal: null };
}

export function actionFrom({ event }: { event: Event }): Pick<Context, "action"> {
  return { action: event.type === "ASK" ? event.action : null };
}

export function clearAction(): Pick<Context, "action"> {
  return { action: null };
}

function isDetail(value: unknown): value is ReaderDetail {
  return typeof value === "object" && value !== null && "id" in value && "books" in value;
}
