/**
 * Where the reader is in the chapter — as plain functions, so they are tested
 * without a DOM (D70). Sections arrive already resolved from the server (D73).
 */

/**
 * How far through the chapter the reader is, 0–1. Zero until the pages reach
 * the top of the screen; one when their last line reaches the bottom. A
 * chapter short enough to fit on one screen is read at a glance: 1.
 *
 * Counting everything merely *visible* as read would open a short chapter
 * already half full, before the reader has read a word.
 */
export function readFraction(
  scrollTop: number,
  viewportHeight: number,
  pagesTop: number,
  pagesHeight: number,
): number {
  if (pagesHeight <= 0) return 0;
  const travel = pagesHeight - viewportHeight;
  if (travel <= 0) return 1;
  const fraction = (scrollTop - pagesTop) / travel;
  return Math.min(1, Math.max(0, fraction));
}

/**
 * The page being read: the last page whose top is above a line a third of the
 * way down the viewport. Zero-based.
 */
export function currentPage(pageTops: number[], probe: number): number {
  let page = 0;
  for (let index = 0; index < pageTops.length; index += 1) {
    if (pageTops[index] <= probe) page = index;
    else break;
  }
  return page;
}

/** One entry in the sections drawer, as `GET /api/grants/{token}/pages` sends it. `page` is zero-based. */
export type Section = { title: string; page: number; depth: number };

/** The section the reader is in: the last one starting at or before `page`. */
export function activeSection(sections: Section[], page: number): number {
  let active = -1;
  sections.forEach((section, index) => {
    if (section.page <= page) active = index;
  });
  return active;
}
