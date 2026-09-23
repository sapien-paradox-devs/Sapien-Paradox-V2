export type ChapterMeta = {
  bookTitle: string;
  number: number;
  title: string;
  /** True only when this request stamped `opened_at` — the ceremony plays (#116). */
  firstOpen: boolean;
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
