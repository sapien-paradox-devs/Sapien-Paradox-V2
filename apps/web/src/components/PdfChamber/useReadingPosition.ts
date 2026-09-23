/**
 * Where the reader is in the chapter, from the window's scroll: the fraction
 * passed (for the progress line, D70) and the page being read (for the
 * sections drawer). One rAF per frame at most.
 */

import { useEffect, useState, type RefObject } from "react";

import { currentPage, readFraction } from "./position";

export type ReadingPosition = { fraction: number; page: number };

export function useReadingPosition(
  ref: RefObject<HTMLDivElement | null>,
  pageCount: number,
): ReadingPosition {
  const [position, setPosition] = useState<ReadingPosition>({ fraction: 0, page: 0 });

  useEffect(() => {
    if (pageCount === 0) return;
    let frame = 0;

    const measure = () => {
      frame = 0;
      const node = ref.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const top = rect.top + window.scrollY;
      const tops = Array.from(
        node.querySelectorAll<HTMLElement>(".pdf-page"),
        (page) => page.getBoundingClientRect().top + window.scrollY,
      );
      setPosition({
        fraction: readFraction(window.scrollY, window.innerHeight, top, rect.height),
        page: currentPage(tops, window.scrollY + window.innerHeight / 3),
      });
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ref, pageCount]);

  return position;
}
