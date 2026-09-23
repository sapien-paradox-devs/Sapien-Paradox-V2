import { fromPromise } from "xstate";

import { mappedFetcher } from "../../../../lib/fetcher";
import type { BookOption, ReaderDetail } from "../../types";
import type { NewReader } from "./types";

/** What is on sale: a reader starts with one of these (D26). */
export const fetchBooks = fromPromise<BookOption[]>(() =>
  mappedFetcher.get<BookOption[]>("/api/books"),
);

export type Created = { reader: ReaderDetail; delivered: boolean };

export const createReader = fromPromise<Created, NewReader | null>(({ input }) =>
  mappedFetcher.post<Created>("/api/admin/readers", input),
);
