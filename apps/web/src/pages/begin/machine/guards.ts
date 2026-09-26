import type { AnyEventObject } from "xstate";

export const isDismissed = ({ event }: { event: AnyEventObject }) => {
  const error = "error" in event ? event.error : null;
  return error instanceof Error && error.message === "dismissed";
};
