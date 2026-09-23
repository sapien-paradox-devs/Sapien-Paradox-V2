import type { AnyEventObject } from "xstate";

import type { Book, Context } from "./types";

export function booksFrom({ event }: { event: AnyEventObject }): Pick<Context, "books"> {
  const output = "output" in event ? event.output : null;
  return { books: Array.isArray(output) ? (output as Book[]) : [] };
}

export function paymentUrlFrom({ event }: { event: AnyEventObject }): Pick<Context, "paymentUrl"> {
  const output = "output" in event ? event.output : null;

  if (typeof output === "object" && output !== null && "paymentUrl" in output) {
    const { paymentUrl } = output as { paymentUrl: unknown };
    return { paymentUrl: typeof paymentUrl === "string" ? paymentUrl : null };
  }
  return { paymentUrl: null };
}

/**
 * Leave the SPA for Razorpay's hosted page.
 *
 * A full navigation, not a fetch: the payment page is theirs, and the card and
 * UPI flows must run on their origin. The reader returns at `/welcome`.
 */
export function leaveForPayment({ context }: { context: Context }) {
  if (context.paymentUrl) window.location.assign(context.paymentUrl);
}
