import type { ReaderDetail, Refusal } from "../../types";

export type Details = { fullName: string; email: string; phone: string };

export type Action = "deactivate" | "reactivate" | "erase";

export type Context = {
  id: string;
  reader: ReaderDetail | null;
  refusal: Refusal | null;
  /** The action awaiting confirmation or in flight. */
  action: Action | null;
};

export type Event =
  | { type: "RETRY" }
  | { type: "EDIT" }
  | { type: "CANCEL" }
  | { type: "SAVE"; details: Details }
  | { type: "CHANGE" }
  | { type: "ASK"; action: Action }
  | { type: "CONFIRM" }
  | { type: "KEEP" };
