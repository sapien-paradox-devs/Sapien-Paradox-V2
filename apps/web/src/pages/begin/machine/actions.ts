import type { AnyEventObject } from "xstate";

import type { Book, Context, OrderDetails, Signup } from "./types";

export function booksFrom({ event }: { event: AnyEventObject }): Pick<Context, "books"> {
  const output = "output" in event ? event.output : null;
  return { books: Array.isArray(output) ? (output as Book[]) : [] };
}

export function orderDetailsFrom({ event }: { event: AnyEventObject }): Pick<Context, "orderDetails"> {
  const output = "output" in event ? event.output : null;

  if (typeof output === "object" && output !== null && "orderId" in output) {
    return { orderDetails: output as OrderDetails };
  }
  return { orderDetails: null };
}

export function signupFrom({ event }: { event: AnyEventObject }): Pick<Context, "signup"> {
  if (event.type === "SUBMIT" && "signup" in event) {
    return { signup: (event as { type: string; signup: Signup }).signup };
  }
  return { signup: null };
}

export function navigateToWelcome({ context }: { context: Context }) {
  const orderId = context.orderDetails?.orderId ?? "";
  window.location.assign(`/welcome?razorpay_order_id=${encodeURIComponent(orderId)}`);
}
