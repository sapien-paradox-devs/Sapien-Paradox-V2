// @vitest-environment jsdom
/**
 * Signing in lands in the library (#193).
 *
 * Renders the whole app, and gives jsdom a view transition that behaves like
 * Chrome's: the update runs a moment later, and a new transition cancels one
 * that has not run yet. Without that, jsdom applies every page change at once
 * and the sign-in loop this test guards against cannot happen.
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Navigator } from "..";

const READER = { id: "1", fullName: "Ada", email: "ada@example.com", phone: "+919876543210", isStaff: false };

type Pending = { update: () => void; cancelled: boolean };
let pending: Pending | null = null;
let requests: string[] = [];
/** URL pushes since the test began. The bug is a loop of them, so it is capped. */
let pushes = 0;
const PUSH_LIMIT = 20;
let container: HTMLDivElement;
let root: Root;

function fakeViewTransitions() {
  const start = (update: () => void) => {
    // Like Chrome: starting a transition skips one still waiting to apply.
    if (pending) pending.cancelled = true;
    const mine: Pending = { update, cancelled: false };
    pending = mine;
    setTimeout(() => {
      if (!mine.cancelled) mine.update();
      if (pending === mine) pending = null;
    }, 5);
    const done = Promise.resolve();
    return { finished: done, ready: done, updateCallbackDone: done, skipTransition: () => {} };
  };
  Object.defineProperty(document, "startViewTransition", { value: start, configurable: true });
}

function fakeApi() {
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const path = new URL(url, "http://x").pathname;
    requests.push(`${init?.method ?? "GET"} ${path}`);
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
    if (path === "/api/auth/me") return json(401, { detail: "unauthorized" });
    if (path === "/api/auth/login") return json(200, READER);
    if (path === "/api/home") return json(200, { books: [] });
    return json(404, {});
  });
}

/** React only notices an input when its value is set the way a browser sets it. */
function type(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  requests = [];
  pending = null;
  pushes = 0;
  window.history.pushState(null, "", "/login");
  // Unbounded, the loop re-renders until the process runs out of memory. Past
  // the limit, pushes stop landing, so the loop starves and the test fails
  // on its assertions instead.
  const push = window.history.pushState.bind(window.history);
  vi.spyOn(window.history, "pushState").mockImplementation((data, unused, url) => {
    pushes += 1;
    if (pushes <= PUSH_LIMIT) push(data, unused, url);
  });
  fakeViewTransitions();
  fakeApi();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("signing in (#193)", () => {
  it("lands in the library, with page changes going through view transitions", async () => {
    await act(async () => {
      root.render(<Navigator />);
      await wait(20);
    });

    const [email, password] = Array.from(container.querySelectorAll("input"));
    await act(async () => {
      type(email, "ada@example.com");
      type(password, "pw");
      container.querySelector("form")?.requestSubmit();
      await wait(200);
    });

    // One push for the sign-in. The bug pushed until something gave way.
    expect(pushes).toBe(1);
    expect(window.location.pathname).toBe("/");
    expect(requests).toContain("GET /api/home");
    expect(requests.filter((r) => r === "POST /api/auth/login")).toHaveLength(1);
  });
});
