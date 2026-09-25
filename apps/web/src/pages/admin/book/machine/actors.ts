import { fromCallback, fromPromise } from "xstate";

import { ApiError, mappedFetcher } from "../../../../lib/fetcher";
import { labels } from "../../../../lib/labels";
import { transfer, type Part, type Plan } from "../../books/transfer";
import { refusalText } from "../../refusal";
import type { BookDetail } from "../../types";
import type { Event, Op, Target } from "./types";

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

export type UploadInput = { id: string; bookId: string; file: File; target: Target; title: string };

/**
 * One file's whole journey (D85): ask for a plan, send the bytes, complete.
 * A child actor, so it reports to the workspace as events and is cancelled
 * (the XHR aborted) if the workspace goes away.
 */
export const uploadFile = fromCallback<Event, UploadInput>(({ input, sendBack }) => {
  const controller = new AbortController();
  const { id, bookId, file, target, title } = input;

  (async () => {
    const plan = await mappedFetcher.post<Plan>("/api/admin/uploads", {
      destination: target.destination,
      bookId: Number(bookId),
      chapterId: "chapterId" in target ? Number(target.chapterId) : null,
      filename: file.name,
      size: file.size,
      title,
    });
    const parts: Part[] | null = await transfer(
      file, plan, (loaded) => sendBack({ type: "UPLOAD_PROGRESS", id, loaded }), controller.signal);
    // The bytes are in; the server now checks them and, for a PDF, renders pages.
    sendBack({ type: "UPLOAD_FINISHING", id });
    const done = await mappedFetcher.post<{ book: BookDetail }>("/api/admin/uploads/complete", {
      ticket: plan.ticket,
      parts,
    });
    sendBack({ type: "UPLOAD_DONE", id, book: done.book });
  })().catch((error: unknown) => {
    if (controller.signal.aborted) return;
    sendBack({ type: "UPLOAD_FAILED", id, message: messageFor(error) });
  });

  return () => controller.abort();
});

function messageFor(error: unknown): string {
  if (error instanceof ApiError && error.code) return refusalText(error.code);
  return labels.admin.book.uploadFailed;
}
