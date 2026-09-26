/** The begin machine — one test per row of its table (D47). */

import { assign, createActor, fromPromise, setup } from "xstate";
import { beforeEach, describe, expect, it } from "vitest";

import { beginConfig } from "../machine";
import * as actions from "../actions";
import * as guards from "../guards";
import type { Book, Context, Event, Signup } from "../types";

const BOOKS: Book[] = [
  { slug: "tsp", title: "The Sapien Paradox", priceMinorUnits: 190000, chapterCount: 5 },
];

const SIGNUP: Signup = {
  fullName: "New Reader", email: "new@example.com",
  phone: "+919111000111", bookSlug: "tsp", pace: "medium", password: "",
};

const ORDER_DETAILS = {
  orderId: "order_TEST0001", keyId: "rzp_test_x",
  amount: 190000, currency: "INR", bookTitle: "The Sapien Paradox",
};

const welcomeUrls: string[] = [];

function machine(options: { books?: "ok" | "fail"; checkout?: "ok" | "fail"; payment?: "ok" | "fail" | "dismiss" } = {}) {
  return setup({
    types: {} as { context: Context; events: Event },
    actions: {
      assignBooks: assign(actions.booksFrom),
      assignOrderDetails: assign(actions.orderDetailsFrom),
      assignSignup: assign(actions.signupFrom),
      navigateToWelcome: ({ context }) => {
        const id = context.orderDetails?.orderId ?? "";
        welcomeUrls.push(`/welcome?razorpay_order_id=${id}`);
      },
    },
    actors: {
      fetchBooks: fromPromise(async () => {
        if (options.books === "fail") throw new Error("nope");
        return BOOKS;
      }),
      startCheckout: fromPromise(async () => {
        if (options.checkout === "fail") throw new Error("nope");
        return ORDER_DETAILS;
      }),
      payAndConfirm: fromPromise(async () => {
        if (options.payment === "dismiss") throw new Error("dismissed");
        if (options.payment === "fail") throw new Error("razorpay_script_failed");
        return { orderId: ORDER_DETAILS.orderId };
      }),
    },
    guards: { isDismissed: guards.isDismissed },
  }).createMachine(beginConfig);
}

function start(options = {}) {
  const actor = createActor(machine(options));
  actor.start();
  return actor;
}

const settle = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => { welcomeUrls.length = 0; });

describe("begin", () => {
  it("loads what is for sale", async () => {
    const actor = start();
    await settle();

    expect(actor.getSnapshot().matches("browsing")).toBe(true);
    expect(actor.getSnapshot().context.books).toEqual(BOOKS);
  });

  it("offers a retry when the catalogue cannot be loaded", async () => {
    const actor = start({ books: "fail" });
    await settle();

    expect(actor.getSnapshot().matches("failed")).toBe(true);
    actor.send({ type: "RETRY" });
    expect(actor.getSnapshot().matches("loading")).toBe(true);
  });

  it("navigates to welcome once payment is confirmed", async () => {
    const actor = start();
    await settle();
    actor.send({ type: "SUBMIT", signup: SIGNUP });
    await settle(); // submitting → paying
    await settle(); // paying → redirecting

    expect(actor.getSnapshot().matches("redirecting")).toBe(true);
    expect(welcomeUrls).toEqual([`/welcome?razorpay_order_id=${ORDER_DETAILS.orderId}`]);
  });

  it("returns to browsing when the modal is dismissed", async () => {
    const actor = start({ payment: "dismiss" });
    await settle();
    actor.send({ type: "SUBMIT", signup: SIGNUP });
    await settle(); // submitting → paying
    await settle(); // paying → browsing (dismissed)

    expect(actor.getSnapshot().matches("browsing")).toBe(true);
    expect(welcomeUrls).toEqual([]);
  });

  it("returns to the form on checkout refusal, and can submit again", async () => {
    const actor = start({ checkout: "fail" });
    await settle();
    actor.send({ type: "SUBMIT", signup: SIGNUP });
    await settle();

    expect(actor.getSnapshot().matches("refused")).toBe(true);
    expect(welcomeUrls).toEqual([]);

    actor.send({ type: "SUBMIT", signup: SIGNUP });
    expect(actor.getSnapshot().matches("submitting")).toBe(true);
  });

  it("shows refused on a non-dismiss payment error", async () => {
    const actor = start({ payment: "fail" });
    await settle();
    actor.send({ type: "SUBMIT", signup: SIGNUP });
    await settle(); // submitting → paying
    await settle(); // paying → refused

    expect(actor.getSnapshot().matches("refused")).toBe(true);
    expect(welcomeUrls).toEqual([]);
  });

  it("preserves signup in context through the flow", async () => {
    const actor = start();
    await settle();
    actor.send({ type: "SUBMIT", signup: SIGNUP });

    expect(actor.getSnapshot().context.signup).toEqual(SIGNUP);
  });
});
