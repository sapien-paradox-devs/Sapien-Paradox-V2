import { fromPromise } from "xstate";

import { mappedFetcher } from "../../../../lib/fetcher";
import type { BookDetail } from "../../types";
import type { NewBook } from "./types";

export const createBook = fromPromise<BookDetail, NewBook | null>(({ input }) =>
  mappedFetcher.post<BookDetail>("/api/admin/books", input),
);
