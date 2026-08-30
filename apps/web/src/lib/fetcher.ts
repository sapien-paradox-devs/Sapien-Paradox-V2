/**
 * The only way this app talks to the API.
 *
 * V1 mandated exactly this and never built it, so every actor hand-rolled `fetch`,
 * invented its own error class (`LoginError`, `GrantFetchError`), and hardcoded
 * `localhost` — which reached review twice. Building it first is the fix.
 *
 * It owns three things every caller would otherwise get wrong:
 *
 * 1. **The base URL**, from env — never a literal host.
 * 2. **`credentials: "include"`**, on every request. The session cookie is scoped to the
 *    parent domain (D6), and one call that forgets this fails in a way that looks like a
 *    backend bug: the request succeeds, the cookie is dropped, the next call is anonymous.
 * 3. **One error shape carrying `status`**, so a guard stays a single line:
 *    `export const isRateLimited = ({ event }) => event.error.status === 429;`
 */

import { API_BASE } from "./env";

export class ApiError extends Error {
  status: number;
  detail: string | null;

  constructor(status: number, detail: string | null) {
    super(detail ?? `Request failed with ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(API_BASE + path, {
    method,
    // Without this the browser neither sends nor stores the session cookie
    // cross-origin, and every signed-in request silently reads as anonymous.
    credentials: "include",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    throw new ApiError(response.status, await readDetail(response));
  }

  // 204, and any other body-less success.
  if (response.status === 204) return undefined as T;

  return (await response.json()) as T;
}

/** The API answers failures with `{ detail }` (D38's refusal code). */
async function readDetail(response: Response): Promise<string | null> {
  try {
    const body = await response.json();
    return typeof body?.detail === "string" ? body.detail : null;
  } catch {
    return null;
  }
}

export const mappedFetcher = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
};
