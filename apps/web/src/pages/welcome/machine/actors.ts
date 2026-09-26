import { fromPromise } from "xstate";

import { mappedFetcher } from "../../../lib/fetcher";
import type { Outcome, ResendOutcome } from "./types";

/**
 * The confirm-on-load leg (D48). With Standard Checkout the begin page already
 * confirmed, so this is the fallback for page reloads or edge cases where the
 * first confirm did not land.
 *
 * Posts only `razorpayOrderId` (no signature). The backend falls back to
 * fetching the order status from Razorpay directly.
 */
export const confirmActor = fromPromise<Outcome, void>(async () => {
  const id = new URLSearchParams(window.location.search).get("razorpay_order_id");

  if (!id) return { status: "pending", delivered: false, hasPhone: true, detail: "no_order_id" };

  return mappedFetcher.post<Outcome>("/api/checkout/confirm", { razorpayOrderId: id });
});


/**
 * Send the chapter and the set-a-password link again.
 *
 * Authorised by the order id, like `confirm`. Everything goes to the phone
 * on the account, so holding the id can make the owner receive a message —
 * never the person asking.
 */
export const resendActor = fromPromise<ResendOutcome, void>(async () => {
  const id = new URLSearchParams(window.location.search).get("razorpay_order_id");

  if (!id) return { status: "pending", chapterSent: false, passwordSent: false, detail: "" };

  return mappedFetcher.post<ResendOutcome>("/api/checkout/resend", { razorpayOrderId: id });
});
