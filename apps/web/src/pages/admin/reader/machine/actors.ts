import { fromPromise } from "xstate";

import { mappedFetcher } from "../../../../lib/fetcher";
import type { ReaderDetail } from "../../types";
import type { Action, Details } from "./types";

export const fetchReader = fromPromise<ReaderDetail, { id: string }>(({ input }) =>
  mappedFetcher.get<ReaderDetail>(`/api/admin/readers/${input.id}`),
);

export const updateReader = fromPromise<ReaderDetail, { id: string; details: Details | null }>(
  ({ input }) => mappedFetcher.patch<ReaderDetail>(`/api/admin/readers/${input.id}`, input.details),
);

/** Remove, restore or erase (D80). Each returns the reader as they now are. */
export const runAction = fromPromise<ReaderDetail, { id: string; action: Action | null }>(
  ({ input }) =>
    mappedFetcher.post<ReaderDetail>(`/api/admin/readers/${input.id}/${input.action ?? ""}`),
);
