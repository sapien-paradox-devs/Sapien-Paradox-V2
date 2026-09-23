/** The shapes of `/api/admin/*` (D82), mirroring `core/schemas/admin.py`. */

export type ReaderRow = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  isActive: boolean;
  isStaff: boolean;
  isErased: boolean;
  bookCount: number;
  joinedAt: string;
};

export type OwnedBook = { title: string; pace: string; since: string };

export type ReaderDetail = ReaderRow & { books: OwnedBook[] };

/** What `GET /api/books` returns per book; the new-reader form picks from it. */
export type BookOption = {
  slug: string;
  title: string;
  priceMinorUnits: number;
  chapterCount: number;
};

export type ReaderStatus = "all" | "active" | "inactive";

/** A refusal code from the API, turned into words (D38). */
export type Refusal = { code: string; field: string | null };
