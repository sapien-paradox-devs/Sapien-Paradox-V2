/**
 * Root actors. Only two — session state is all this level owns.
 *
 * Login is deliberately absent: it belongs to the login page, which needs
 * `submitting` and `error` for its own form anyway (D15).
 */

import { fromPromise } from "xstate";

import { mappedFetcher } from "../../lib/fetcher";
import type { User } from "./types";

/**
 * Runs on boot for everyone, including token visitors, who 401 harmlessly.
 * One wasted request buys the deletion of a special case that would otherwise
 * have to be remembered forever (D15).
 */
export const checkSession = fromPromise<User>(() =>
  mappedFetcher.get<User>("/api/auth/me"),
);

export const logoutActor = fromPromise<void>(() =>
  mappedFetcher.post<void>("/api/auth/logout"),
);
