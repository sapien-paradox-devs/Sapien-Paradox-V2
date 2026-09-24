/**
 * A book's cover in the admin, proxied through the staff endpoint so drafts
 * show too (mandate 3). Without one, a typographic stand-in in the Jewel
 * palette, so no book is ever a blank square (D79).
 */

import { API_BASE } from "../../../lib/env";

const TINTS = ["cobalt", "coral", "saffron", "teal"] as const;

export function Cover({ bookId, title, hasCover, version = 0 }: {
  bookId: string;
  title: string;
  hasCover: boolean;
  /** Changes when the cover is replaced, so the browser fetches the new one. */
  version?: number;
}) {
  if (hasCover) {
    return (
      <img className="admin-cover" alt="" loading="lazy"
        src={`${API_BASE}/api/admin/books/${bookId}/cover?v=${version}`} />
    );
  }
  const tint = TINTS[Number(bookId) % TINTS.length];
  return (
    <div className={`admin-cover admin-cover-blank admin-cover-${tint}`} aria-hidden="true">
      <span>{title}</span>
    </div>
  );
}
