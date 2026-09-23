/**
 * Light, dark, or whatever the device says (#120).
 *
 * The *preference* is one of three and is what the reader chooses. The *theme*
 * is one of two and is what is painted: `data-theme` on <html> is always
 * resolved, so the CSS keys on the attribute alone and never needs a copy of
 * the palette under a media query.
 *
 * The inline script in index.html does the first resolve before paint — it
 * cannot import this file. It mirrors `THEME_STORAGE_KEY` and `resolveTheme`,
 * and a test reads index.html to keep the key in step.
 */

import { transition } from "./motion";

export type ThemePreference = "system" | "light" | "dark";
export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "sp-theme";

const ORDER: ThemePreference[] = ["system", "light", "dark"];

/** The browser bar colour per theme — the two `--paper` values in global.css. */
const THEME_COLOR: Record<Theme, string> = { light: "#f5f6f2", dark: "#101714" };

const DARK_QUERY = "(prefers-color-scheme: dark)";

export function nextPreference(current: ThemePreference): ThemePreference {
  return ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
}

export function resolveTheme(preference: ThemePreference, systemDark: boolean): Theme {
  if (preference === "system") return systemDark ? "dark" : "light";
  return preference;
}

function isPreference(value: string | null): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

/**
 * A per-device convenience, so storage failing — private mode, blocked site
 * data — falls back to following the device rather than throwing.
 */
export function readPreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isPreference(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

export function writePreference(preference: ThemePreference): void {
  try {
    if (preference === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Not remembered on this device; still applied for this visit.
  }
}

export function systemPrefersDark(): boolean {
  return window.matchMedia?.(DARK_QUERY).matches ?? false;
}

/** Calls back whenever the device switches between light and dark. */
export function onSystemChange(callback: () => void): () => void {
  const query = window.matchMedia?.(DARK_QUERY);
  if (!query) return () => {};
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (root.dataset.theme === theme) return;

  // A crossfade where the browser offers one (D54).
  transition(() => {
    root.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", THEME_COLOR[theme]);
  }, { kind: "theme" });
}
