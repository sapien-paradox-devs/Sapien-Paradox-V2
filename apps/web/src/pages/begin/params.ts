/**
 * What `/begin` was asked for, read once from its query string (#160).
 *
 * `?book=<slug>` — which book (the catalogue's *Buy*, D79); the first on sale
 * otherwise. `?pace=` — carried over from the landing page's pace switch.
 * Unknown values fall back rather than failing: a mistyped link still sells.
 */

import { PACE, type Pace } from "../../lib/constants";
import type { Book } from "./machine";

export function paceFrom(value: string | null): Pace {
  return PACE.find((key) => key === value) ?? PACE[1];
}

export function bookFrom(books: Book[], slug: string | null): Book | null {
  return books.find((book) => book.slug === slug) ?? books[0] ?? null;
}
