import { fromPromise } from "xstate";

import { mappedFetcher } from "../../../lib/fetcher";
import type { User } from "../../machine";

export type Credentials = { email: string; password: string };

export const loginActor = fromPromise<User, Credentials>(({ input }) =>
  mappedFetcher.post<User>("/api/auth/login", input),
);

export type LinkRequest = { phone: string };

/**
 * Always answers the same way whether or not the number is known — the endpoint
 * refuses to be an oracle for who has an account, so the UI must not imply one
 * either.
 */
export const requestLinkActor = fromPromise<void, LinkRequest>(({ input }) =>
  mappedFetcher.post<void>("/api/auth/reset/request", input),
);
