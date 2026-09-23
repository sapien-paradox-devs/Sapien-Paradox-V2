import { fromPromise } from "xstate";

import { mappedFetcher } from "../../../../lib/fetcher";
import type { ReaderRow, ReaderStatus } from "../../types";

export type ReaderQuery = { search: string; status: ReaderStatus };

export const fetchReaders = fromPromise<ReaderRow[], ReaderQuery>(async ({ input }) => {
  const query = new URLSearchParams({ search: input.search, status: input.status });
  const body = await mappedFetcher.get<{ readers: ReaderRow[] }>(`/api/admin/readers?${query}`);
  return body.readers;
});
