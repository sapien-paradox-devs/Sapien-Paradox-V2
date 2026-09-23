/**
 * System → light → dark, one tap each (#120). Lives in the site header's
 * trailing slot.
 *
 * Plain React state, not a machine: one value cycling through three, with no
 * async work and no lifecycle beyond following the device while on "system".
 */

import { useEffect, useState } from "react";

import { labels } from "../../lib/labels";
import {
  applyTheme,
  nextPreference,
  onSystemChange,
  readPreference,
  resolveTheme,
  systemPrefersDark,
  writePreference,
  type ThemePreference,
} from "../../lib/theme";
import "./ThemeToggle.css";

export function ThemeToggle() {
  const [preference, setPreference] = useState<ThemePreference>(readPreference);

  useEffect(() => {
    const paint = () => applyTheme(resolveTheme(preference, systemPrefersDark()));
    paint();
    return preference === "system" ? onSystemChange(paint) : undefined;
  }, [preference]);

  const choose = () => {
    const next = nextPreference(preference);
    writePreference(next);
    setPreference(next);
  };

  const label = labels.theme[preference];

  return (
    <button type="button" className="ui-theme" onClick={choose} aria-label={label} title={label}>
      <ThemeIcon preference={preference} />
    </button>
  );
}

function ThemeIcon({ preference }: { preference: ThemePreference }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      {preference === "light" && (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
        </>
      )}
      {preference === "dark" && <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10Z" />}
      {preference === "system" && (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" stroke="none" />
        </>
      )}
    </svg>
  );
}
