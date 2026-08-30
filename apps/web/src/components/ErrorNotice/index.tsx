/**
 * A failure message with an optional retry. Renders props only — no machine
 * (D15): the failure and its retry belong to whichever machine hit it.
 *
 * D41 — failure states are named for what the reader can do about them, not
 * for the status code. This component doesn't know the difference between
 * `sanctuary`, `denied`, and a generic `error`; it just renders the message
 * and the action its caller decided to offer, or none at all.
 */

import { Button } from "../Button";
import "./ErrorNotice.css";

export type ErrorNoticeProps = {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
};

export function ErrorNotice({ message, onRetry, retryLabel }: ErrorNoticeProps) {
  return (
    <p className="error-notice" role="alert">
      <span>{message}</span>
      {onRetry && retryLabel && (
        <Button variant="secondary" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </p>
  );
}
