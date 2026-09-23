/**
 * A placeholder in the shape of what is about to appear (#161).
 *
 * Props only, no machine. Always `aria-hidden`: a screen reader hears the one
 * `LoadingNote` beside it, never a list of grey boxes.
 */

import type { CSSProperties, ReactNode } from "react";

import "./Skeleton.css";

type Props = {
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
  /** A page-shaped box: width ÷ height. */
  ratio?: string;
  round?: boolean;
  className?: string;
};

export function Skeleton({ width = "100%", height = "1em", ratio, round, className }: Props) {
  return (
    <span
      aria-hidden="true"
      className={`ui-skeleton${round ? " ui-skeleton-round" : ""}${className ? ` ${className}` : ""}`}
      style={ratio ? { width, aspectRatio: ratio } : { width, height }}
    />
  );
}

/** The one thing assistive tech hears while placeholders are shown. */
export function LoadingNote({ children }: { children: ReactNode }) {
  return (
    <p className="visually-hidden" role="status" aria-live="polite">
      {children}
    </p>
  );
}
