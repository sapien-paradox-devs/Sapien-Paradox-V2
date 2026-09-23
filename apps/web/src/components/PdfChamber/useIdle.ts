/**
 * True after `ms` without the reader reaching for anything — the cue for the
 * chamber's controls to fade (PLAN 5.2.4, D70). Pointer movement, a touch, a
 * key, or scrolling back up wakes them; reading on down does not.
 */

import { useEffect, useState } from "react";

export function useIdle(ms: number, paused: boolean): boolean {
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    if (paused) {
      setIdle(false);
      return;
    }

    let timer = 0;
    let lastY = window.scrollY;

    const wake = () => {
      setIdle(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setIdle(true), ms);
    };

    const onScroll = () => {
      const y = window.scrollY;
      if (y < lastY - 4) wake();
      lastY = y;
    };

    wake();
    const events = ["pointermove", "touchstart", "keydown"] as const;
    events.forEach((name) => window.addEventListener(name, wake, { passive: true }));
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.clearTimeout(timer);
      events.forEach((name) => window.removeEventListener(name, wake));
      window.removeEventListener("scroll", onScroll);
    };
  }, [ms, paused]);

  return idle;
}
