import type { Section } from "../position";

/** A page's size in PDF points, so its box is the right shape before the image arrives. */
export type PageSize = { width: number; height: number };

/**
 * The chapter's shape, from `GET /api/grants/{token}/pages` (D73). The PDF
 * itself never reaches the browser; each page arrives as an image.
 */
export type Layout = {
  pages: PageSize[];
  /** The PDF's own bookmarks, flattened, zero-based pages. Empty when it has none. */
  sections: Section[];
};

export type Context = { token: string; layout: Layout | null };
export type Event = { type: "RETRY" };
