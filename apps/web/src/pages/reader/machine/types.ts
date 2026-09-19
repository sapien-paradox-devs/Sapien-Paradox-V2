export type ChapterMeta = {
  bookTitle: string;
  number: number;
  title: string;
};

export type Context = {
  token: string;
  chapter: ChapterMeta | null;
};

export type Event = { type: "FINISH" } | { type: "REISSUE" } | { type: "RETRY" };
