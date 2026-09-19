/** Something went wrong, and what to do about it. */

import type { ReactNode } from "react";
import { Button } from "../Button";
import "./ErrorNotice.css";

export function ErrorNotice({
  children,
  action,
  onAction,
}: {
  children: ReactNode;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="ui-error" role="alert">
      <p>{children}</p>
      {action && onAction && (
        <Button variant="quiet" onClick={onAction}>{action}</Button>
      )}
    </div>
  );
}
