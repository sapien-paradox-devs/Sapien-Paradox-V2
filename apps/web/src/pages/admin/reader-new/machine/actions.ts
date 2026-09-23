import type { AnyEventObject } from "xstate";

import { refusalOf } from "../../refusal";
import type { BookOption, ReaderDetail } from "../../types";
import type { Context } from "./types";

export function booksFrom({ event }: { event: AnyEventObject }): Pick<Context, "books"> {
  const output = "output" in event ? event.output : null;
  return { books: Array.isArray(output) ? output.filter(isBook) : [] };
}

export function createdFrom({ event }: { event: AnyEventObject }): Pick<Context, "created" | "delivered"> {
  const output = "output" in event ? event.output : null;
  if (typeof output !== "object" || output === null || !("reader" in output)) {
    return { created: null, delivered: false };
  }
  const reader: unknown = Reflect.get(output, "reader");
  const delivered: unknown = Reflect.get(output, "delivered");
  return { created: isDetail(reader) ? reader : null, delivered: delivered === true };
}

export function refusalFrom({ event }: { event: AnyEventObject }): Pick<Context, "refusal"> {
  return { refusal: refusalOf(event) };
}

export function clearRefusal(): Pick<Context, "refusal"> {
  return { refusal: null };
}

function isBook(value: unknown): value is BookOption {
  return typeof value === "object" && value !== null && "slug" in value && "title" in value;
}

function isDetail(value: unknown): value is ReaderDetail {
  return typeof value === "object" && value !== null && "id" in value && "books" in value;
}
