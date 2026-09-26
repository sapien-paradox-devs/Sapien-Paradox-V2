import { fromPromise } from "xstate";

import { mappedFetcher } from "../../../lib/fetcher";
import type { Book, OrderDetails, Signup } from "./types";

/** What is for sale. Anonymous — this is the front door (D47). */
export const fetchBooks = fromPromise<Book[]>(() =>
  mappedFetcher.get<Book[]>("/api/books"),
);

/** Create a Razorpay order. Returns what the modal needs to open. */
export const startCheckout = fromPromise<OrderDetails, Signup>(({ input }) =>
  mappedFetcher.post<OrderDetails>("/api/checkout", input),
);

type RazorpayConstructor = new (opts: Record<string, unknown>) => { open: () => void };

function loadScript(): Promise<void> {
  if ((window as Window & { Razorpay?: unknown }).Razorpay) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("razorpay_script_failed"));
    document.head.appendChild(script);
  });
}

/**
 * Open the Razorpay modal, wait for payment, then verify with the backend.
 *
 * Resolves with the Razorpay order ID on success (even if the confirm call
 * fails — the welcome page retries). Rejects with message `"dismissed"` when
 * the user closes the modal without paying.
 */
export const payAndConfirm = fromPromise<
  { orderId: string },
  { orderDetails: OrderDetails; signup: Signup }
>(async ({ input }) => {
  const { orderDetails, signup } = input;

  await loadScript();

  const Razorpay = (window as Window & { Razorpay?: RazorpayConstructor }).Razorpay;
  if (!Razorpay) throw new Error("razorpay_script_failed");

  const payment = await new Promise<{
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }>((resolve, reject) => {
    const rzp = new Razorpay({
      key: orderDetails.keyId,
      amount: orderDetails.amount,
      currency: orderDetails.currency,
      name: "Sapien Paradox",
      description: orderDetails.bookTitle,
      order_id: orderDetails.orderId,
      prefill: {
        name: signup.fullName,
        email: signup.email,
        contact: signup.phone,
      },
      handler: resolve,
      modal: { ondismiss: () => reject(new Error("dismissed")) },
    });
    rzp.open();
  });

  try {
    const body: Record<string, string> = {
      razorpayOrderId: payment.razorpay_order_id,
      razorpayPaymentId: payment.razorpay_payment_id,
      razorpaySignature: payment.razorpay_signature,
    };
    if (signup.password) body.password = signup.password;
    await mappedFetcher.post("/api/checkout/confirm", body);
  } catch {
    // Best-effort. The welcome page calls confirm again on load.
  }

  return { orderId: orderDetails.orderId };
});
