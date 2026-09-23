/** `/begin` while what is on sale loads: the title, the book, four fields (#161). */

import { LoadingNote, Skeleton } from "../../components/Skeleton";
import { labels } from "../../lib/labels";

export function BeginSkeleton() {
  return (
    <main className="shell">
      <div className="begin">
        <LoadingNote>{labels.begin.loading}</LoadingNote>
        <Skeleton width="12rem" height="2.2rem" />
        <Skeleton width="90%" height="0.95rem" className="begin-skeleton-lede" />
        <div className="begin-form">
          <Skeleton width="60%" height="1.4rem" />
          <Skeleton width="35%" height="0.9rem" />
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} height="2.6rem" />
          ))}
          <Skeleton height="2.8rem" />
        </div>
      </div>
    </main>
  );
}
