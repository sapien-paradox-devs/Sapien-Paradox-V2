import type { AnyEventObject } from "xstate";

const status = (event: AnyEventObject) =>
  "output" in event ? (event.output as { status?: string })?.status : undefined;

export const isFulfilled = ({ event }: { event: AnyEventObject }) => status(event) === "fulfilled";

export const isPending = ({ event }: { event: AnyEventObject }) => status(event) === "pending";

/**
 * They already own the book. Not a failure — the grant exists and the links can
 * simply be sent again, which is the one thing this reader actually needs.
 */
export const isOwned = ({ event }: { event: AnyEventObject }) => status(event) === "owned";
