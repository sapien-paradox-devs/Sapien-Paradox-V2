/** A button. Render props only — no machine (D15). */

import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./Button.css";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "solid" | "quiet" | "text";
  children: ReactNode;
};

export function Button({ variant = "solid", className, children, ...rest }: Props) {
  return (
    <button className={`ui-btn ui-btn-${variant} ${className ?? ""}`} {...rest}>
      {children}
    </button>
  );
}
