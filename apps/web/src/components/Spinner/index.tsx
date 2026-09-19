/** A waiting mark. Words, not a spinner — this product does not hurry (D14). */

import "./Spinner.css";

export function Spinner({ label }: { label: string }) {
  return (
    <p className="ui-spinner" role="status">
      <span className="ui-spinner-dot" aria-hidden="true" />
      {label}
    </p>
  );
}
