export type Chapter = {
  id: string;
  number: number;
  title: string;
  /** Opened at least once. */
  read: boolean;
  /** 0–1; 1 only once the reader marked it complete (D70). */
  progress: number;
  completed: boolean;
};

export type Book = {
  id: string;
  title: string;
  /** The mean across its chapters (D70). */
  progress: number;
  chapters: Chapter[];
};

export type Context = {
  books: Book[];
  /** The chapter whose link is being sent, so one row can show its own state. */
  sendingChapterId: string | null;
};

export type Event =
  | { type: "RETRY" }
  | { type: "SEND"; chapterId: string }
  | { type: "DISMISS" };
