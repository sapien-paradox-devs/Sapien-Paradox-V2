import type { AnyEventObject } from "xstate";

import { refusalOf } from "../../refusal";
import type { Event } from "./types";

/** Every field filled. The server checks the rest. */
export const isComplete = ({ event }: { event: Event }) =>
  event.type === "SUBMIT" &&
  [event.reader.fullName, event.reader.email, event.reader.phone, event.reader.bookSlug].every(
    (value) => value.trim().length > 0,
  );

/** A 409 with a code: the form can say what went wrong and where. */
export const isRefusal = ({ event }: { event: AnyEventObject }) => refusalOf(event) !== null;
