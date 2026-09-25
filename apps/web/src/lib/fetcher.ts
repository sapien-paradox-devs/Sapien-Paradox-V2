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
 * 4. **The CSRF header** on every unsafe request (D30). The token comes from the
 *    `X-CSRFToken` response header that `/api/auth/me` and login send, kept in
 *    memory, because while the app and API are on unrelated sites the app cannot
 *    read the API's cookie (#176). The cookie is the fallback.
 */

import { API_BASE } from "./env";

export class ApiError extends Error {
  status: number;
  detail: string | null;
  /**
   * A refusal the API attached to a field (`{ code, field }`, the admin's 409s),
   * so a form can show the message where the person is looking.
   */
  code: string | null;
  field: string | null;

  constructor(status: number, detail: string | null, code: string | null = null,
    field: string | null = null) {
    super(detail ?? code ?? `Request failed with ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
    this.code = code;
    this.field = field;
  }
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** The token the API last handed over in a header (#176). Never persisted. */
let handedOver: string | null = null;

function remember(response: Response): void {
  const token = response.headers.get("X-CSRFToken");
  if (token) handedOver = token;
}

/** The CSRF token: the one the API handed over, else Django's cookie when readable. */
function csrfToken(): string | null {
  if (handedOver) return handedOver;
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/** The CSRF header for a request made outside `request` (an upload's XHR, D85). */
export function csrfHeader(): Record<string, string> {
  const token = csrfToken();
  return token ? { "X-CSRFToken": token } : {};
}

function headersFor(method: string, hasBody: boolean): Record<string, string> {
  const headers: Record<string, string> = {};
  if (hasBody) headers["Content-Type"] = "application/json";
  const token = SAFE_METHODS.has(method) ? null : csrfToken();
  if (token) headers["X-CSRFToken"] = token;
  return headers;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(API_BASE + path, {
    method,
    // Without this the browser neither sends nor stores the session cookie
    // cross-origin, and every signed-in request silently reads as anonymous.
    credentials: "include",
    headers: headersFor(method, body !== undefined),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  remember(response);

  if (!response.ok) {
    throw await errorFrom(response);
  }

  // 204, and any other body-less success.
  if (response.status === 204) return undefined as T;

  return (await response.json()) as T;
}

/** The API answers failures with `{ detail }` (D38's refusal code), or with
 * `{ code, field }` for a refusal that belongs to a form field. */
async function readDetail(response: Response): Promise<string | null> {
  return (await readBody(response)).detail;
}

async function readBody(
  response: Response,
): Promise<{ detail: string | null; code: string | null; field: string | null }> {
  try {
    const body: unknown = await response.json();
    const pick = (key: string) =>
      typeof body === "object" && body !== null && key in body
        ? stringOrNull(Reflect.get(body, key))
        : null;
    return { detail: pick("detail"), code: pick("code"), field: pick("field") };
  } catch {
    return { detail: null, code: null, field: null };
  }
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

async function errorFrom(response: Response): Promise<ApiError> {
  const { detail, code, field } = await readBody(response);
  return new ApiError(response.status, detail, code, field);
}

/** Binary bodies — a chapter's page images (D73). Same credentials, same errors. */
async function blob(path: string): Promise<Blob> {
  const response = await fetch(API_BASE + path, { credentials: "include" });
  if (!response.ok) {
    throw new ApiError(response.status, await readDetail(response));
  }
  return response.blob();
}

/**
 * Fire-and-forget POST that survives the page closing (`keepalive`), for the
 * last word of a reading session on `pagehide` (D70). Errors are dropped:
 * there is nobody left to show them to.
 */
function send(path: string, body: unknown): void {
  void fetch(API_BASE + path, {
    method: "POST",
    credentials: "include",
    keepalive: true,
    headers: headersFor("POST", true),
    body: JSON.stringify(body),
  }).catch(() => {});
}

export const mappedFetcher = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
  blob,
  send,
};
