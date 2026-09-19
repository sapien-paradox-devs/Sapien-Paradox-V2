/**
 * Environment, read once and validated.
 *
 * The API lives on a different origin in production (D6): the SPA is served from
 * `app.<domain>` and Django from `api.<domain>`. A hardcoded host reached review twice
 * in V1, so there is exactly one place that knows the address.
 */

/** Empty in development, where Vite proxies `/api`. Absolute in production. */
export const API_BASE: string = (import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");
