import type { AnyEventObject } from "xstate";

import type { Context } from "./types";

export function tokenFrom({ event }: { event: AnyEventObject }): Pick<Context, "token"> {
  const output = "output" in event ? event.output : null;

  if (typeof output === "object" && output !== null && "token" in output) {
    const { token } = output;
    return { token: typeof token === "string" ? token : null };
  }
  return { token: null };
}
