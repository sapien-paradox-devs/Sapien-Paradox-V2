import { fromPromise } from "xstate";

import { mappedFetcher } from "../../../lib/fetcher";

export type ResetConfirm = { token: string; password: string };

export const confirmActor = fromPromise<void, ResetConfirm>(({ input }) =>
  mappedFetcher.post<void>("/api/auth/reset/confirm", input),
);
