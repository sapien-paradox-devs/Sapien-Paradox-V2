import type { AnyEventObject } from "xstate";

import type { Context } from "./types";

export function outcomeFrom({ event }: { event: AnyEventObject }): Context {
  const output = "output" in event ? (event.output as Context & { detail?: string }) : null;
  return {
    delivered: Boolean(output?.delivered),
    detail: output?.detail ?? "",
  };
}
