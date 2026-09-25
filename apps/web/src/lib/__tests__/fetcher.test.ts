import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, mappedFetcher } from "../fetcher";

type Call = { url: string; init: RequestInit };

let calls: Call[] = [];

/** Stubs `fetch` with a real Response, so nothing here needs a cast. */
function respondWith(status: number, body?: string) {
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(body ?? null, { status });
  });
}

/** Asserts the promise fails, and hands back the error already narrowed. */
async function failureOf(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error("expected the request to fail, but it resolved");
}

beforeEach(() => {
  calls = [];
});

afterEach(() => vi.unstubAllGlobals());

describe("mappedFetcher", () => {
  it("sends credentials on every request", async () => {
    respondWith(200, "{}");

    await mappedFetcher.get("/api/auth/me");

    expect(calls[0].init.credentials).toBe("include");
  });

  it("returns the decoded body", async () => {
    respondWith(200, JSON.stringify({ email: "reader@example.com" }));

    const user = await mappedFetcher.get<{ email: string }>("/api/auth/me");

    expect(user.email).toBe("reader@example.com");
  });

  it("puts the status on the error, so guards stay one line", async () => {
    respondWith(429, JSON.stringify({ detail: "rate_limited" }));

    const error = await failureOf(mappedFetcher.post("/api/chapters/1/send"));

    expect(error.status).toBe(429);
    expect(error.detail).toBe("rate_limited");
  });

  it("survives a failure whose body is not JSON", async () => {
    respondWith(502, "<html>bad gateway</html>");

    const error = await failureOf(mappedFetcher.get("/api/home"));

    expect(error.status).toBe(502);
    expect(error.detail).toBeNull();
  });

  it("sends a JSON body and its content type on post", async () => {
    respondWith(200, "{}");

    await mappedFetcher.post("/api/auth/login", { email: "a@b.c" });

    expect(calls[0].init.body).toBe(JSON.stringify({ email: "a@b.c" }));
    expect(calls[0].init.headers).toMatchObject({
      "Content-Type": "application/json",
    });
  });

  it("does not try to decode a 204", async () => {
    respondWith(204);

    await expect(mappedFetcher.post("/api/auth/logout")).resolves.toBeUndefined();
  });

  it("prefixes the configured API base", async () => {
    respondWith(200, "{}");

    await mappedFetcher.get("/api/home");

    // The base is empty in test, so the path passes through unchanged. What
    // matters is that nothing hardcodes a host.
    expect(calls[0].url).toBe("/api/home");
  });

  it("sends the CSRF token the API handed over in a header (#176)", async () => {
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response("{}", { status: 200, headers: { "X-CSRFToken": "handed-over" } });
    });

    await mappedFetcher.get("/api/auth/me");
    await mappedFetcher.post("/api/auth/logout");

    expect(new Headers(calls[1].init.headers).get("X-CSRFToken")).toBe("handed-over");
    // Reads do not carry it.
    expect(new Headers(calls[0].init.headers).get("X-CSRFToken")).toBeNull();
  });
});
