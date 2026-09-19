import { fromPromise } from "xstate";

import { mappedFetcher } from "../../../lib/fetcher";
import type { Book } from "./types";

type HomePayload = { books: Book[] };

/** No tokens in this payload — Home links are minted on demand (D11). */
export const fetchHome = fromPromise<HomePayload>(() =>
  mappedFetcher.get<HomePayload>("/api/home"),
);

export const sendChapter = fromPromise<void, { chapterId: string }>(({ input }) =>
  mappedFetcher.post<void>(`/api/chapters/${input.chapterId}/send`),
);
