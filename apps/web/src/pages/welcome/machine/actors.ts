import { fromPromise } from "xstate";

import { mappedFetcher } from "../../../lib/fetcher";
import type { Outcome } from "./types";

/**
 * The redirect leg (D48). Razorpay appends `razorpay_payment_link_id` to the
 * callback URL; the server asks Razorpay whether that link was actually paid, so
 * the parameter selects which link to check and is never proof of anything.
 *
 * With no id there is nothing to confirm — report `pending` rather than claiming
 * a delivery, and let the webhook do its job.
 */
export const confirmActor = fromPromise<Outcome, void>(async () => {
  const id = new URLSearchParams(window.location.search).get("razorpay_payment_link_id");

  if (!id) return { status: "pending", delivered: false, detail: "no_payment_link_id" };

  return mappedFetcher.post<Outcome>("/api/checkout/confirm", { paymentLinkId: id });
});
