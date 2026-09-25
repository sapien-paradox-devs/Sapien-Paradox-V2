import type { Refusal } from "../../types";

export type NewBook = { title: string; author: string; description: string; priceMinorUnits: number };

export type Context = { createdId: string | null; refusal: Refusal | null };

export type Event = { type: "SUBMIT"; book: NewBook } | { type: "EDIT" };
