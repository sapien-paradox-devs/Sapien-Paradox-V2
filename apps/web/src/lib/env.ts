/**
 * Environment, read once and validated.
 *
 * The API lives on a different origin in production (D6): the SPA is served from
 * `app.<domain>` and Django from `api.<domain>`. A hardcoded host reached review twice
 * in V1, so there is exactly one place that knows the address.
 */

/**
 * TEMPORARY (#90). Where the API lives when nothing says otherwise.
 *
 * Vite inlines env vars at build time, so `VITE_API_BASE` has to exist before the
 * build runs and the build must not be cached. While that is being sorted out, a
 * production build with no variable set falls back here rather than calling its own
 * origin — which 404s every request and makes the whole app look broken.
 *
 * This is a second place that knows the API address, which D6 exists to prevent.
 * **Delete it once the real domain is pointed** and `VITE_API_BASE` is set once,
 * properly. It is not a long-term arrangement.
 */
const PRODUCTION_FALLBACK = "https://sapien-api.onrender.com";

function resolveApiBase(): string {
  const configured = import.meta.env.VITE_API_BASE;
  if (configured) return configured.replace(/\/$/, "");

  // Development leaves this empty on purpose: Vite proxies `/api` to localhost:8000,
  // so same-origin is correct there and a fallback would bypass the proxy.
  return import.meta.env.PROD ? PRODUCTION_FALLBACK : "";
}

/** Empty in development, where Vite proxies `/api`. Absolute in production. */
export const API_BASE: string = resolveApiBase();
