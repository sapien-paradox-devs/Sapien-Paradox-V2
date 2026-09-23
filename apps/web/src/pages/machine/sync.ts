/**
 * URL → machine. The only sender of `ROUTE`.
 *
 * Navigation is unidirectional (D15): a page asks for a URL, the URL is pushed,
 * and the change arrives back here as a `ROUTE`. One path→state mapping, and no
 * machine↔URL loop to guard against.
 *
 * Because every page change passes through here, this is also where the page
 * transition starts (D54). The first ROUTE on mount does not animate — there is
 * no previous page to move from.
 */

import { transition } from "../../lib/motion";

export function startRouteSync(send: (event: { type: "ROUTE"; path: string }) => void) {
  const announce = () => send({ type: "ROUTE", path: window.location.pathname });

  const onPopState = (event: PopStateEvent) =>
    transition(announce, { kind: "page", skip: event.hasUAVisualTransition === true });

  announce();
  window.addEventListener("popstate", onPopState);

  return () => window.removeEventListener("popstate", onPopState);
}
