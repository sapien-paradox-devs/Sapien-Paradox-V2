import { fromPromise } from "xstate";

import { mappedFetcher } from "../../../lib/fetcher";

/** Mint-or-reuse. A GET, and idempotent — reuse a live grant, mint if none (D32). */
export const resolveChapter = fromPromise<{ token: string }, { chapterId: string }>(
  ({ input }) => mappedFetcher.get<{ token: string }>(`/api/read/${input.chapterId}`),
);
