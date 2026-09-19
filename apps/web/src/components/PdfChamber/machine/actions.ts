import type { AnyEventObject } from "xstate";

import type { Context } from "./types";

export function urlFrom({ event }: { event: AnyEventObject }): Pick<Context, "objectUrl"> {
  const output = "output" in event ? event.output : null;
  return { objectUrl: typeof output === "string" ? output : null };
}
