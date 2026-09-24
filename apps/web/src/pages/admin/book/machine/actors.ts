import { fromPromise } from "xstate";

import { ApiError, mappedFetcher } from "../../../../lib/fetcher";
import type { BookDetail } from "../../types";
import type { Op } from "./types";

export const fetchBook = fromPromise<BookDetail, { id: string }>(({ input }) =>
  mappedFetcher.get<BookDetail>(`/api/admin/books/${input.id}`),
);

/** One change, one request; each returns the book as it now is. */
export const runOp = fromPromise<BookDetail, { id: string; op: Op | null }>(({ input }) => {
  const { id, op } = input;
  const book = `/api/admin/books/${id}`;
  switch (op?.kind) {
    case "details":
      return mappedFetcher.patch<BookDetail>(book, op.details);
    case "rename":
      return mappedFetcher.patch<BookDetail>(`/api/admin/chapters/${op.chapterId}`, { title: op.title });
    case "reorder":
      return mappedFetcher.post<BookDetail>(`${book}/chapters/order`, {
        chapterIds: op.chapterIds.map(Number),
      });
    case "deleteChapter":
      return mappedFetcher.delete<BookDetail>(`/api/admin/chapters/${op.chapterId}`);
    case "retryChapter":
      return mappedFetcher.post<BookDetail>(`/api/admin/chapters/${op.chapterId}/retry`);
    case "removeChapterVideo":
      return mappedFetcher.delete<BookDetail>(`/api/admin/chapters/${op.chapterId}/video`);
    case "removeMedia":
      return mappedFetcher.delete<BookDetail>(`${book}/media/${op.which}`);
    case "publish":
      return mappedFetcher.post<BookDetail>(`${book}/publish`);
    case "unpublish":
      return mappedFetcher.post<BookDetail>(`${book}/unpublish`);
    default:
      return Promise.reject(new ApiError(400, "no_op"));
  }
});
