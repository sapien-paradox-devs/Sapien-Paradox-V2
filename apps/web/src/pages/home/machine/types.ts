export type Chapter = {
  id: string;
  number: number;
  title: string;
  /** A quiet mark, not a progress bar (D11). */
  read: boolean;
};

export type Book = {
  id: string;
  title: string;
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
