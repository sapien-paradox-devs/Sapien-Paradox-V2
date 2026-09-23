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
  // The `progress` region (D70, D42): the furthest point reached, the furthest
  // point the server has, when it was last told, and whether the chapter is
  // complete (after which nothing more is sent).
  latest: number;
  sent: number;
  lastSentAt: number;
  completed: boolean;
};

export type Event =
  | { type: "FINISH" }
  | { type: "REISSUE" }
  | { type: "RETRY" }
  /** Tap or key during the threshold ceremony. */
  | { type: "SKIP" }
  /** The chamber reports the furthest point the reader has reached, 0–1. */
  | { type: "PROGRESS"; fraction: number }
  /** The page is closing or being left: send what the server does not have yet. */
  | { type: "FLUSH" };
