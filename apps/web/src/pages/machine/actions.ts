/**
 * Root actions.
 *
 * The two `assign`s hold the session. The three router calls are plain
 * functions, not `assign` — they change the URL, not the context.
 *
 * Navigation is unidirectional (D15): pushing a URL is the whole job, and the
 * change comes back as a `ROUTE` event through `sync.ts`. Nothing here targets
 * a state.
 */

import type { AnyEventObject } from "xstate";

import { ROUTES } from "../../lib/constants";
import type { Context, Event, User } from "./types";

/**
 * The two context updaters are plain functions returning the patch. `index.ts`
 * wraps them in `assign` inside `setup`, which is where XState can infer the
 * context and event types — calling `assign` out here widens the event to
 * `EventObject` and the machine then refuses the action.
 */
export function userFrom({ event }: { event: Event }): Pick<Context, "user"> {
  return { user: event.type === "AUTHENTICATED" ? event.user : null };
}

export function noUser(): Pick<Context, "user"> {
  return { user: null };
}

/**
 * The boot check delivers its reader as the actor's `output`, not as an
 * AUTHENTICATED event, so it needs its own updater. Sharing one would silently
 * leave `user` null after a successful session check — which looks exactly like
 * being logged out.
 */
export function userFromCheck({ event }: { event: AnyEventObject }): Pick<Context, "user"> {
  const output = "output" in event ? event.output : null;
  return { user: isUser(output) ? output : null };
}

/** A malformed /api/auth/me leaves the reader logged out, not half-signed-in. */
function isUser(value: unknown): value is User {
  return typeof value === "object" && value !== null && "email" in value;
}

/** The single place a URL is pushed. `sync.ts` turns it back into a ROUTE. */
function push(to: string) {
  window.history.pushState(null, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

/** Reads `to` off the NAVIGATE event rather than taking action params. */
export function pushUrl({ event }: { event: Event }) {
  if (event.type === "NAVIGATE") push(event.to);
}

export function goToHome() {
  push(ROUTES.home);
}

export function goToLogin() {
  push(ROUTES.login);
}
