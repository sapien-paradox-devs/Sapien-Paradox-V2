/** Two A4-shaped boxes: the chamber before its layout arrives (#161). */

import { Skeleton } from "../Skeleton";

export function PageSkeletons() {
  return (
    <div className="pdf-pages">
      <Skeleton ratio="595 / 842" className="pdf-page-skeleton" />
      <Skeleton ratio="595 / 842" className="pdf-page-skeleton" />
    </div>
  );
}
