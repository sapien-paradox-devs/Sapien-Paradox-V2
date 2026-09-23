/** The reader while the link is checked: book, title, then page-shaped boxes (#161). */

import { PageSkeletons } from "../../components/PdfChamber/PageSkeletons";
import { LoadingNote, Skeleton } from "../../components/Skeleton";
import { labels } from "../../lib/labels";

export function ReaderSkeleton() {
  return (
    <main className="reader">
      <LoadingNote>{labels.reader.loading}</LoadingNote>
      <div className="reader-opening reader-skeleton-head">
        <Skeleton width="9rem" height="0.75rem" />
        <Skeleton width="min(22rem, 80%)" height="2.2rem" />
      </div>
      <PageSkeletons />
    </main>
  );
}
