/**
 * The threshold — the first open of a chapter link (#116, BUSINESS.md).
 *
 * The book's name, the chapter's numeral, its title, a hairline, then the
 * card lifts and the chamber is already there underneath. About 2.5 seconds,
 * and any tap or key skips it.
 *
 * Renders props only. Which beat is showing is the reader machine's
 * `chamber.threshold` state; this just maps it to what is visible.
 */

import { useEffect } from "react";

import { labels } from "../../lib/labels";
import type { ChapterMeta } from "./machine";

export type ThresholdBeat = "gathering" | "titled" | "ruled" | "lifting";

const ORDER: ThresholdBeat[] = ["gathering", "titled", "ruled", "lifting"];

export function Threshold({
  chapter,
  beat,
  onSkip,
}: {
  chapter: ChapterMeta;
  beat: ThresholdBeat;
  onSkip: () => void;
}) {
  // Any key, not only Enter or Space: someone pressing Escape wants it gone.
  useEffect(() => {
    const onKey = () => onSkip();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSkip]);

  // A class that stays on once earned, so an animation never restarts when a
  // later beat arrives.
  const reached = (at: ThresholdBeat) => (ORDER.indexOf(beat) >= ORDER.indexOf(at) ? " on" : "");

  return (
    <button
      type="button"
      className={`threshold${beat === "lifting" ? " lifting" : ""}`}
      onClick={onSkip}
      aria-label={labels.reader.threshold.skip}
    >
      <span className="threshold-inner">
        <span className={`threshold-book${reached("gathering")}`}>{chapter.bookTitle}</span>
        <span className={`threshold-numeral${reached("gathering")}`}>
          <span className="threshold-numeral-label">{labels.reader.threshold.chapter}</span>
          {toRoman(chapter.number)}
        </span>
        <span className={`threshold-title${reached("titled")}`}>{chapter.title}</span>
        <span className={`threshold-rule${reached("ruled")}`} />
        <span className={`threshold-hint${reached("ruled")}`}>{labels.reader.threshold.begin}</span>
      </span>
    </button>
  );
}

/** 1 → I, 4 → IV, 12 → XII. Chapters are few; anything odd falls back to digits. */
export function toRoman(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 3999) return String(n);
  const table: [number, string][] = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
    [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let rest = n;
  let out = "";
  for (const [value, glyph] of table) {
    while (rest >= value) {
      out += glyph;
      rest -= value;
    }
  }
  return out;
}
