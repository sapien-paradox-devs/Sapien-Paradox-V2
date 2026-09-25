import type { AnyEventObject } from "xstate";

import { refusalOf } from "../../refusal";
import type { Context } from "./types";

export function createdFrom({ event }: { event: AnyEventObject }): Pick<Context, "createdId"> {
  const output = "output" in event ? event.output : null;
  const id: unknown = typeof output === "object" && output !== null ? Reflect.get(output, "id") : null;
  return { createdId: typeof id === "string" ? id : null };
}

export function refusalFrom({ event }: { event: AnyEventObject }): Pick<Context, "refusal"> {
  return { refusal: refusalOf(event) ?? { code: "failed", field: null } };
}

export function clearRefusal(): Pick<Context, "refusal"> {
  return { refusal: null };
}
