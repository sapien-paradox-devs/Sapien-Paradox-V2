/** Home while the library loads: the heading, a book, five chapter rows (#161). */

import { LoadingNote, Skeleton } from "../../components/Skeleton";
import { labels } from "../../lib/labels";

export function HomeSkeleton() {
  return (
    <div className="home-skeleton">
      <LoadingNote>{labels.health.booting}</LoadingNote>
      <Skeleton width="11rem" height="1.1rem" />
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="home-skeleton-row">
          <Skeleton width="1rem" height="0.9rem" />
          <Skeleton width={`${[62, 48, 55, 70, 44][index]}%`} height="1rem" />
          <Skeleton width="8.5rem" height="2rem" className="home-skeleton-button" />
        </div>
      ))}
    </div>
  );
}
