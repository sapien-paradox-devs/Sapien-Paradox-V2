import { fromPromise } from "xstate";

import { mappedFetcher } from "../../../../lib/fetcher";
import type { BookRow } from "../../types";

export const fetchBooks = fromPromise<BookRow[]>(async () =>
  (await mappedFetcher.get<{ books: BookRow[] }>("/api/admin/books")).books,
);
