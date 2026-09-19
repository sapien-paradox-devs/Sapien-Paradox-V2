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
