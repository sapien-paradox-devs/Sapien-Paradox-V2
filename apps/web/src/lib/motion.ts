/**
 * The one place a view transition starts (D54).
 *
 * Anything that swaps one screen for another goes through `transition`: page
 * navigation (from `pages/machine/sync.ts`) and the theme (`lib/theme.ts`).
 * What the transition *looks like* is CSS — the `::view-transition-*` rules in
 * global.css — so this file only decides whether one runs at all.
 */

import { flushSync } from "react-dom";

/**
 * What is changing. Set as `data-transition` on <html> for the length of the
 * transition, so the CSS can give a page change its rise and leave a theme
 * change as a plain crossfade — the whole page moving 8px because the colours
 * changed would be wrong. (View Transition *types* do this natively, but not
 * yet in every Safari a reader might have.)
 */
export type TransitionKind = "page" | "theme";

type Options = {
  kind: TransitionKind;
  /**
   * Skip the transition and just apply the update. For a back/forward swipe
   * the browser has already animated itself (`hasUAVisualTransition`); a second
   * animation on top reads as a stutter.
   */
  skip?: boolean;
};

/**
 * Runs `update` inside a view transition where the browser supports one, and
 * directly otherwise.
 *
 * React is flushed inside the callback: the browser snapshots the new state the
 * moment the callback returns, so a render still queued at that point would be
 * captured half-done.
 *
 * Reduced motion does not skip it. The CSS turns it into a short crossfade with
 * no movement, which is gentler than a hard cut (D54).
 */
export function transition(update: () => void, { kind, skip = false }: Options): void {
  if (skip || typeof document.startViewTransition !== "function") {
    update();
    return;
  }

  const root = document.documentElement;
  root.dataset.transition = kind;

  const running = document.startViewTransition(() => flushSync(update));
  running.finished.finally(() => {
    // A newer transition may already have claimed the attribute.
    if (root.dataset.transition === kind) delete root.dataset.transition;
  });
}
