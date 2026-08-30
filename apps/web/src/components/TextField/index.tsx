/**
 * A labelled text input. Renders props only — no machine (D15): the value and
 * any validation state live in whichever form is using it.
 */

import "./TextField.css";

export type TextFieldProps = {
  id: string;
  label: string;
  type?: "text" | "email" | "password";
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  disabled?: boolean;
  errorMessage?: string | null;
};

export function TextField({
  id,
  label,
  type = "text",
  value,
  onChange,
  autoComplete,
  disabled = false,
  errorMessage = null,
}: TextFieldProps) {
  const errorId = errorMessage ? `${id}-error` : undefined;

  return (
    <div className="text-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        disabled={disabled}
        aria-invalid={errorMessage ? true : undefined}
        aria-describedby={errorId}
        onChange={(event) => onChange(event.target.value)}
      />
      {errorMessage && (
        <p id={errorId} className="text-field-error" role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
