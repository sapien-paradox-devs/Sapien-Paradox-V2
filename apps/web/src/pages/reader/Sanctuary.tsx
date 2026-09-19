/**
 * The expired-link screen. Shares the `/r/:token` route with the chamber.
 *
 * Soft expiry, no shouting: the link rested, and one tap brings a fresh one
 * (D9). The re-issue request runs in its own region so pressing the button does
 * not blank this screen (D42).
 */

import { labels } from "../../lib/labels";

type ReissueState = "idle" | "sending" | "sent" | "limited" | "failed";

export function Sanctuary({
  reissue,
  onReissue,
}: {
  reissue: ReissueState;
  onReissue: () => void;
}) {
  return (
    <main className="sanctuary">
      <h1>{labels.sanctuary.title}</h1>
      <p>{labels.sanctuary.body}</p>

      {(reissue === "idle" || reissue === "failed") && (
        <button onClick={onReissue}>{labels.sanctuary.reissue}</button>
      )}

      {reissue === "sending" && <p>{labels.sanctuary.sending}</p>}
      {reissue === "sent" && <p role="status">{labels.sanctuary.sent}</p>}
      {/* Already sent is a success, not a failure (D45). */}
      {reissue === "limited" && <p role="status">{labels.sanctuary.limited}</p>}
      {reissue === "failed" && <p role="alert">{labels.sanctuary.failed}</p>}
    </main>
  );
}
