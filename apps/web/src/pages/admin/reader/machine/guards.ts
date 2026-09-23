import type { AnyEventObject } from "xstate";

import { refusalOf } from "../../refusal";
import type { Context, Event } from "./types";

/** An erased reader's details are placeholders and stay that way (D80). */
export const isEditable = ({ context }: { context: Context }) =>
  context.reader !== null && !context.reader.isErased;

/** Only actions that make sense for the reader as they are now. */
export const isAllowed = ({ context, event }: { context: Context; event: Event }) => {
  const reader = context.reader;
  if (event.type !== "ASK" || reader === null || reader.isErased) return false;
  if (event.action === "reactivate") return !reader.isActive;
  if (event.action === "deactivate") return reader.isActive;
  return true; // erase
};

/** Restoring a removed reader: allowed, and needs no confirmation. */
export const isRestore = ({ context, event }: { context: Context; event: Event }) =>
  event.type === "ASK" && event.action === "reactivate" && isAllowed({ context, event });

export const isErase = ({ context }: { context: Context }) => context.action === "erase";

export const isRefusal = ({ event }: { event: AnyEventObject }) => refusalOf(event) !== null;
