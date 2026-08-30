/**
 * A quiet loading indicator. Renders props only — no machine (D15): whatever is
 * loading owns that state and decides when to show this.
 *
 * `label` is required rather than defaulted, so no caller can reach for this
 * component without a string already in hand from `labels.ts` (mandate 1).
 */

import "./Spinner.css";

export type SpinnerProps = {
  label: string;
};

export function Spinner({ label }: SpinnerProps) {
  return (
    <div className="spinner" role="status">
      <span className="spinner-mark" aria-hidden="true" />
      <span className="spinner-label">{label}</span>
    </div>
  );
}
