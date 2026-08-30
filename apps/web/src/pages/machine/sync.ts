/**
 * URL → machine. The only sender of `ROUTE`.
 *
 * Navigation is unidirectional (D15): a page asks for a URL, the URL is pushed,
 * and the change arrives back here as a `ROUTE`. One path→state mapping, and no
 * machine↔URL loop to guard against.
 */

export function startRouteSync(send: (event: { type: "ROUTE"; path: string }) => void) {
  const announce = () => send({ type: "ROUTE", path: window.location.pathname });

  announce();
  window.addEventListener("popstate", announce);

  return () => window.removeEventListener("popstate", announce);
}
