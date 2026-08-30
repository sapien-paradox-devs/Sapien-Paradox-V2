import { fromPromise } from "xstate";

import { mappedFetcher } from "../../../lib/fetcher";
import type { User } from "../../machine";

export type Credentials = { email: string; password: string };

export const loginActor = fromPromise<User, Credentials>(({ input }) =>
  mappedFetcher.post<User>("/api/auth/login", input),
);
