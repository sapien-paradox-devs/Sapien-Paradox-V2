/**
 * `/` while the session check is still out (#161).
 *
 * The Navigator renders neither Home nor the landing page until it knows which
 * (D44: never guess). On a sleeping free-tier API that can take most of a
 * minute, and a blank page reads as broken. These shapes fit either outcome:
 * a heading, a paragraph, a few lines.
 */

import { LoadingNote, Skeleton } from "../components/Skeleton";
import { labels } from "../lib/labels";

export function BootSkeleton() {
  return (
    <main className="boot-skeleton">
      <LoadingNote>{labels.health.booting}</LoadingNote>
      <Skeleton width="min(24rem, 85%)" height="2.4rem" />
      <Skeleton width="min(30rem, 95%)" height="1rem" />
      <Skeleton width="min(26rem, 80%)" height="1rem" />
      <Skeleton width="min(20rem, 60%)" height="1rem" />
    </main>
  );
}
