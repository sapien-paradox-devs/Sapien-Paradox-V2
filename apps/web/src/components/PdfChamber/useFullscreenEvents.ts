/**
 * The browser's side of full screen (#198), handed to the machine as events.
 *
 * A hook may subscribe to browser events and pass them on (apps/web/CLAUDE.md);
 * the machine decides. `fullscreenchange` fires on entering too, so only a change
 * that leaves the page without a full-screen element is reported.
 */

import { useEffect } from "react";

type Send = (event: { type: "TOGGLE_FULLSCREEN" } | { type: "FULLSCREEN_EXITED" }) => void;

export function useFullscreenEvents(send: Send): void {
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) send({ type: "FULLSCREEN_EXITED" });
    };

    // `f` toggles full screen, as in most readers and players. Never while
    // typing, so the companion's box can take the letter.
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "f" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) {
        return;
      }
      event.preventDefault();
      send({ type: "TOGGLE_FULLSCREEN" });
    };

    document.addEventListener("fullscreenchange", onChange);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      window.removeEventListener("keydown", onKey);
    };
  }, [send]);
}
