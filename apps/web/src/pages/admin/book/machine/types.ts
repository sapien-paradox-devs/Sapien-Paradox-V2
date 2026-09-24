import type { BookDetail, Refusal } from "../../types";

/** Where an uploaded file goes (D85). */
export type Target =
  | { destination: "new_chapter" }
  | { destination: "chapter_pdf" | "chapter_video"; chapterId: string }
  | { destination: "book_video" | "book_sample" | "book_cover" };

export type UploadStatus = "queued" | "sending" | "finishing" | "failed" | "done";

export type UploadItem = {
  id: string;
  file: File;
  target: Target;
  /** A new chapter's title, cleaned from its filename and editable before confirming (D86). */
  title: string;
  status: UploadStatus;
  loaded: number;
  error: string | null;
};

/** A dropped folder of PDFs, before the admin confirms it (D86). */
export type StagedChapter = { key: string; file: File; title: string };
export type StagedPdfs = { chapters: StagedChapter[]; skipped: string[] };

/** Where a dropped video is headed: a chapter's id, the book video, the sample, or the tray. */
export type Slot = { kind: "chapter"; chapterId: string } | { kind: "book_video" } | { kind: "book_sample" } | { kind: "tray" };
export type StagedVideo = { key: string; file: File; slot: Slot };
export type StagedVideos = { videos: StagedVideo[]; skipped: string[] };

export type Details = { title: string; author: string; description: string; priceMinorUnits: number };

/** One change to the book or a chapter. Each is a single request that returns the book. */
export type Op =
  | { kind: "details"; details: Details }
  | { kind: "rename"; chapterId: string; title: string }
  | { kind: "reorder"; chapterIds: string[] }
  | { kind: "deleteChapter"; chapterId: string }
  | { kind: "retryChapter"; chapterId: string }
  | { kind: "removeChapterVideo"; chapterId: string }
  | { kind: "removeMedia"; which: "cover" | "video" | "sample" }
  | { kind: "publish" }
  | { kind: "unpublish" };

export type Context = {
  id: string;
  book: BookDetail | null;
  refusal: Refusal | null;
  /** The op in flight, so the screen can show which row is busy. */
  op: Op | null;
  stagedPdfs: StagedPdfs | null;
  stagedVideos: StagedVideos | null;
  uploads: UploadItem[];
  nextUploadId: number;
};

export type Event =
  | { type: "RETRY" }
  | { type: "RUN"; op: Op }
  | { type: "DISMISS_REFUSAL" }
  // D86: a dropped folder or batch, staged until confirmed
  | { type: "STAGE_PDFS"; files: File[] }
  | { type: "RETITLE_STAGED"; key: string; title: string }
  | { type: "MOVE_STAGED"; from: number; to: number }
  | { type: "UNSTAGE"; key: string }
  | { type: "CONFIRM_PDFS" }
  | { type: "CANCEL_PDFS" }
  | { type: "STAGE_VIDEOS"; files: File[] }
  | { type: "ASSIGN_VIDEO"; key: string; slot: Slot }
  | { type: "CONFIRM_VIDEOS" }
  | { type: "CANCEL_VIDEOS" }
  // D85: one file, straight to a known place
  | { type: "UPLOAD"; file: File; target: Target }
  | { type: "RETRY_UPLOAD"; id: string }
  | { type: "CLEAR_UPLOADS" }
  // from the upload children
  | { type: "UPLOAD_PROGRESS"; id: string; loaded: number }
  | { type: "UPLOAD_FINISHING"; id: string }
  | { type: "UPLOAD_DONE"; id: string; book: BookDetail }
  | { type: "UPLOAD_FAILED"; id: string; message: string };
