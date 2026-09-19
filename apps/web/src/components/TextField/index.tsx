/** A labelled input. Render props only (D15). */

import type { InputHTMLAttributes } from "react";
import "./TextField.css";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
};

export function TextField({ label, hint, id, ...rest }: Props) {
  const inputId = id ?? `f-${label.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div className="ui-field">
      <label htmlFor={inputId}>{label}</label>
      <input id={inputId} {...rest} />
      {hint && <span className="ui-field-hint">{hint}</span>}
    </div>
  );
}
