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

// ── books (D83–D86) ───────────────────────────────────────────────────────────

export type BookRow = {
  id: string;
  slug: string;
  title: string;
  author: string;
  isPublished: boolean;
  chapterCount: number;
  readyCount: number;
  hasCover: boolean;
  readerCount: number;
  createdAt: string;
};

export type AdminChapter = {
  id: string;
  number: number;
  title: string;
  /** `ready`: pages rendered. `failed`: the PDF did not render (D73). */
  status: "ready" | "failed";
  pageCount: number | null;
  hasVideo: boolean;
  /** Someone holds a link to it: it cannot be deleted (D84). */
  hasReaders: boolean;
};

export type Checklist = { hasChapters: boolean; allReady: boolean; hasCover: boolean; passes: boolean };

export type BookDetail = BookRow & {
  description: string;
  priceMinorUnits: number;
  hasVideo: boolean;
  hasSample: boolean;
  chapters: AdminChapter[];
  checklist: Checklist;
};
