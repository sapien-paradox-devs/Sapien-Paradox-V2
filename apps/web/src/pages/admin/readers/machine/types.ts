import type { ReaderRow, ReaderStatus } from "../../types";

export type Context = {
  readers: ReaderRow[];
  search: string;
  status: ReaderStatus;
};

export type Event =
  | { type: "SEARCH"; search: string }
  | { type: "STATUS"; status: ReaderStatus }
  | { type: "RETRY" };
