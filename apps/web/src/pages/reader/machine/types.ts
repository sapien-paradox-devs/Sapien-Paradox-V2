export type ChapterMeta = {
  bookTitle: string;
  number: number;
  title: string;
  /** True only when this request stamped `opened_at` — the ceremony plays (#116). */
  firstOpen: boolean;
  /** Where the reader got to last time, 0–1, and whether they marked it complete (D70). */
  furthest: number;
  completed: boolean;
};

export type Context = {
  token: string;
  chapter: ChapterMeta | null;
};

export type Event =
  | { type: "FINISH" }
  | { type: "REISSUE" }
  | { type: "RETRY" }
  /** Tap or key during the threshold ceremony. */
  | { type: "SKIP" };
