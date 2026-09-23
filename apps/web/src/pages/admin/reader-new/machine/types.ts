import type { BookOption, ReaderDetail, Refusal } from "../../types";

export type NewReader = {
  fullName: string;
  email: string;
  phone: string;
  bookSlug: string;
  pace: string;
};

export type Context = {
  books: BookOption[];
  refusal: Refusal | null;
  created: ReaderDetail | null;
  /** Whether chapter 1 left for their WhatsApp (D26): the admin can fix a bad number now. */
  delivered: boolean;
};

export type Event =
  | { type: "SUBMIT"; reader: NewReader }
  | { type: "EDIT" }
  | { type: "RETRY" };
