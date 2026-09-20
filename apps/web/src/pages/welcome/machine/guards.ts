import type { AnyEventObject } from "xstate";

const status = (event: AnyEventObject) =>
  "output" in event ? (event.output as { status?: string })?.status : undefined;

export const isFulfilled = ({ event }: { event: AnyEventObject }) => status(event) === "fulfilled";

export const isPending = ({ event }: { event: AnyEventObject }) => status(event) === "pending";
