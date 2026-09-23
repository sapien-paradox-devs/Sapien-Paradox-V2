import type { AnyEventObject } from "xstate";

import { mappedFetcher } from "../../../lib/fetcher";
import type { ChapterMeta, Context, Event } from "./types";

/** Movements smaller than this are not worth a request (D70). */
export const PROGRESS_STEP = 0.01;
const SETTLE_MS = 1500;
const MIN_INTERVAL_MS = 5000;

/**
 * The chapter, and where the progress region starts from: the reader's last
 * place, already on the server, so nothing is re-sent.
 */
export function chapterFrom({
  event,
}: {
  event: AnyEventObject;
}): Pick<Context, "chapter" | "latest" | "sent" | "completed"> {
  const output = "output" in event ? event.output : null;
  const chapter = isChapter(output) ? output : null;
  const place = chapter?.completed ? 1 : (chapter?.furthest ?? 0);
  return { chapter, latest: place, sent: place, completed: chapter?.completed ?? false };
}

export function latestFrom({
  context,
  event,
}: {
  context: Context;
  event: Event;
}): Pick<Context, "latest"> {
  return {
    latest: event.type === "PROGRESS" ? Math.max(context.latest, event.fraction) : context.latest,
  };
}

/** The save's actor returns the number it sent. */
export function sentFrom({ event }: { event: AnyEventObject }): Pick<Context, "sent" | "lastSentAt"> {
  const output = "output" in event && typeof event.output === "number" ? event.output : 0;
  return { sent: output, lastSentAt: Date.now() };
}

export function flushed({ context }: { context: Context }): Pick<Context, "sent" | "lastSentAt"> {
  return { sent: context.latest, lastSentAt: Date.now() };
}

export function completedNow(): Pick<Context, "completed" | "latest" | "sent"> {
  return { completed: true, latest: 1, sent: 1 };
}

/**
 * The last word as the page closes: a `keepalive` request that outlives it.
 * Side effect only — the context update is `assignFlushed`.
 */
export function sendOnExit({ context }: { context: Context }): void {
  mappedFetcher.send(`/api/grants/${context.token}/progress`, { furthest: context.latest });
}

/** How long `waiting` lasts: at least the settle, and never sooner than the interval allows. */
export function nextSendDelay(now: number, lastSentAt: number): number {
  return Math.max(SETTLE_MS, MIN_INTERVAL_MS - (now - lastSentAt));
}

export function videoUrlFrom({
  event,
}: {
  event: AnyEventObject;
}): Pick<Context, "videoUrl"> {
  const output = "output" in event ? event.output : null;
  return { videoUrl: typeof output === "string" ? output : null };
}

export function clearVideo(): Pick<Context, "videoUrl"> {
  return { videoUrl: null };
}

function isChapter(value: unknown): value is ChapterMeta {
  return typeof value === "object" && value !== null && "title" in value;
}
