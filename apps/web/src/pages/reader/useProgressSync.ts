/**
 * Sends the reader's furthest point to the server — quietly and rarely (D70).
 *
 * Once scrolling settles (1.5 s), never more than every 5 s, and once more as
 * the page closes. A reader scrolling through a chapter makes a handful of
 * requests, not hundreds. The server keeps the maximum, so an out-of-order or
 * repeated send is harmless.
 */

import { useCallback, useEffect, useRef } from "react";

import { mappedFetcher } from "../../lib/fetcher";

const SETTLE_MS = 1500;
const MIN_INTERVAL_MS = 5000;
/** Movements smaller than this are not worth a request. */
const STEP = 0.01;

/** How long to wait before sending: at least the settle, and never sooner than the interval allows. */
export function nextSendDelay(now: number, lastSentAt: number): number {
  return Math.max(SETTLE_MS, MIN_INTERVAL_MS - (now - lastSentAt));
}

export function useProgressSync(
  token: string,
  startAt: number,
  enabled: boolean,
): (fraction: number) => void {
  const latest = useRef(startAt);
  const sent = useRef(startAt);
  const lastSentAt = useRef(0);
  const timer = useRef(0);

  useEffect(() => {
    latest.current = Math.max(latest.current, startAt);
    sent.current = Math.max(sent.current, startAt);
  }, [startAt]);

  const path = `/api/grants/${token}/progress`;

  const flush = useCallback(() => {
    if (latest.current - sent.current < STEP) return;
    sent.current = latest.current;
    lastSentAt.current = Date.now();
    mappedFetcher.post<void>(path, { furthest: latest.current }).catch(() => {
      // Lost this time; the next send carries the same or a larger number.
      sent.current = 0;
    });
  }, [path]);

  useEffect(() => {
    if (!enabled) return;
    const onHide = () => {
      window.clearTimeout(timer.current);
      if (latest.current - sent.current < STEP) return;
      sent.current = latest.current;
      mappedFetcher.send(path, { furthest: latest.current });
    };
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      onHide();
    };
  }, [enabled, path]);

  return useCallback(
    (fraction: number) => {
      if (!enabled || fraction <= latest.current) return;
      latest.current = fraction;
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, nextSendDelay(Date.now(), lastSentAt.current));
    },
    [enabled, flush],
  );
}
