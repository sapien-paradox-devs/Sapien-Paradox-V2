/**
 * The one clickable primitive every page reaches for. Renders props only — no
 * machine (D15): submitting/disabled/label state belongs to whichever page or
 * component machine is driving the click.
 */

import type { ReactNode } from "react";

import "./Button.css";

export type ButtonVariant = "primary" | "secondary";

export type ButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: ButtonVariant;
  disabled?: boolean;
};

export function Button({
  children,
  onClick,
  type = "button",
  variant = "primary",
  disabled = false,
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`button button-${variant}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
