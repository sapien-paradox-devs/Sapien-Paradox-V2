import type { AnyEventObject } from "xstate";

import type { Context } from "./types";

export function outcomeFrom({ event }: { event: AnyEventObject }): Pick<Context, "delivered" | "hasPhone" | "detail"> {
  const output = "output" in event ? (event.output as Context & { detail?: string; hasPhone?: boolean }) : null;
  return {
    delivered: Boolean(output?.delivered),
    hasPhone: output?.hasPhone !== false,
    detail: output?.detail ?? "",
  };
}


export function resendOutcomeFrom({ event }: { event: AnyEventObject }): Pick<Context, "resend"> {
  return { resend: "output" in event ? (event.output as Context["resend"]) : null };
}

export function resendFailed(): Pick<Context, "resend"> {
  return { resend: { status: "refused", chapterSent: false, passwordSent: false, detail: "" } };
}
