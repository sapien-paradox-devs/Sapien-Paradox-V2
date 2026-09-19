/** The landing machine — one test per row of its table (D47). */

import { createActor, fromPromise } from "xstate";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { landingConfig } from "../machine";
import { setup, assign } from "xstate";
import * as actions from "../actions";
import type { Book, Context, Event, Signup } from "../types";

const BOOKS: Book[] = [
  { slug: "tsp", title: "The Sapien Paradox", priceMinorUnits: 190000, chapterCount: 5 },
];

const SIGNUP: Signup = {
  fullName: "New Reader", email: "new@example.com",
  phone: "+919111000111", bookSlug: "tsp", pace: "medium",
};

const left: string[] = [];

function machine(options: { books?: "ok" | "fail"; checkout?: "ok" | "fail" } = {}) {
  return setup({
    types: {} as { context: Context; events: Event },
    actions: {
      assignBooks: assign(actions.booksFrom),
      assignPaymentUrl: assign(actions.paymentUrlFrom),
      // Stubbed: the real one calls window.location.assign, which jsdom cannot.
      leaveForPayment: ({ context }) => { if (context.paymentUrl) left.push(context.paymentUrl); },
    },
    actors: {
      fetchBooks: fromPromise(async () => {
        if (options.books === "fail") throw new Error("nope");
        return BOOKS;
      }),
      startCheckout: fromPromise(async () => {
        if (options.checkout === "fail") throw new Error("nope");
        return { paymentUrl: "https://rzp.io/i/abc" };
      }),
    },
  }).createMachine(landingConfig);
}

function start(options = {}) {
  const actor = createActor(machine(options));
  actor.start();
  return actor;
}

const settle = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => { left.length = 0; });

describe("landing", () => {
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

  it("redirects to the gateway once checkout succeeds", async () => {
    const actor = start();
    await settle();
    actor.send({ type: "SUBMIT", signup: SIGNUP });
    await settle();

    expect(actor.getSnapshot().matches("redirecting")).toBe(true);
    expect(left).toEqual(["https://rzp.io/i/abc"]);
  });

  it("returns to the form on refusal, and can submit again", async () => {
    const actor = start({ checkout: "fail" });
    await settle();
    actor.send({ type: "SUBMIT", signup: SIGNUP });
    await settle();

    expect(actor.getSnapshot().matches("refused")).toBe(true);
    expect(left).toEqual([]);

    actor.send({ type: "SUBMIT", signup: SIGNUP });
    expect(actor.getSnapshot().matches("submitting")).toBe(true);
  });

  it("never leaves for payment without a url", async () => {
    const actor = start({ checkout: "fail" });
    await settle();
    actor.send({ type: "SUBMIT", signup: SIGNUP });
    await settle();

    expect(actor.getSnapshot().context.paymentUrl).toBeNull();
    expect(left).toEqual([]);
  });
});
