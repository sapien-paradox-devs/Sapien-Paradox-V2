import type { AnyEventObject } from "xstate";

import type { Context, Layout } from "./types";

export function layoutFrom({ event }: { event: AnyEventObject }): Pick<Context, "layout"> {
  const output = "output" in event ? event.output : null;
  return { layout: isLayout(output) ? output : null };
}

// ── full screen (#198) ──────────────────────────────────────────────────────
// Side effects, not context: whether the page is immersive lives in the machine's
// state, and these only tell the browser and the stylesheet.

const IMMERSIVE = "immersive";

/** Mark the page immersive and ask the browser for full screen. A refusal is fine. */
export function enterFullscreen(): void {
  document.documentElement.dataset.view = IMMERSIVE;
  const root = document.documentElement;
  if (!document.fullscreenElement && typeof root.requestFullscreen === "function") {
    root.requestFullscreen().catch(() => {});
  }
}

export function leaveFullscreen(): void {
  dropImmersive();
  if (document.fullscreenElement && typeof document.exitFullscreen === "function") {
    document.exitFullscreen().catch(() => {});
  }
}

export function dropImmersive(): void {
  if (document.documentElement.dataset.view === IMMERSIVE) delete document.documentElement.dataset.view;
}

function isLayout(value: unknown): value is Layout {
  return (
    typeof value === "object" &&
    value !== null &&
    "pages" in value &&
    Array.isArray(value.pages) &&
    "sections" in value &&
    Array.isArray(value.sections)
  );
}
