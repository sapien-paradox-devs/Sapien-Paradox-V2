import { fromPromise } from "xstate";

import { mappedFetcher } from "../../../lib/fetcher";
import type { Book, Signup } from "./types";

/** What is for sale. Anonymous — this is the front door (D47). */
export const fetchBooks = fromPromise<Book[]>(() =>
  mappedFetcher.get<Book[]>("/api/books"),
);

/**
 * Start a purchase. Returns Razorpay's hosted page.
 *
 * Nothing is created here: a reader exists only once the money does, and the
 * webhook is what creates them (D47).
 */
export const startCheckout = fromPromise<{ paymentUrl: string }, Signup>(({ input }) =>
  mappedFetcher.post<{ paymentUrl: string }>("/api/checkout", input),
);
