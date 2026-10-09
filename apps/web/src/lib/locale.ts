/**
 * Dot-notation reader for `labels.ts` (mandate 1).
 *
 * **Typed to return `string`.** V1 weakened this to `any` and the PR was
 * blocked: the moment it returns `any`, a typo like `t("home.greting")` reaches
 * the screen as `undefined` instead of failing.
 *
 * A missing key returns the key itself rather than throwing. A blank space where
 * copy should be is a bug someone reports; a white screen is an outage.
 */

import { labels } from "./labels";

export function t(path: string): string {
  const value = path
    .split(".")
    .reduce<unknown>(
      (node, key) =>
        typeof node === "object" && node !== null && key in node
          ? (node as Record<string, unknown>)[key]
          : undefined,
      labels,
    );

  return typeof value === "string" ? value : path;
}

/**
 * A day, written the way the product writes days: "Fri, 17 Oct".
 *
 * One formatter, because two surfaces show dates — the landing page's arrival
 * strip and Home's locked chapters (#114) — and a reader comparing them should
 * not meet two spellings of the same thing. **Dates, never countdowns** (D11):
 * a countdown turns waiting into a timer, which is the opposite of the point.
 */
const DAY = new Intl.DateTimeFormat("en-IN", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

export function formatDay(date: Date): string {
  return DAY.format(date);
}

/** The same, from the ISO string an API sends. Empty for null or unparseable. */
export function formatDayISO(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : formatDay(date);
}
