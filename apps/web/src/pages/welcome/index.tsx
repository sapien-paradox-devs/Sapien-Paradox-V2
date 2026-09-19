/**
 * Where Razorpay sends the reader back (D47).
 *
 * Deliberately says almost nothing. The webhook is what creates the reader, and
 * it may not have arrived yet — so this page must not claim the purchase
 * succeeded, nor that it failed. It tells them where to look: WhatsApp.
 *
 * No polling. A spinner that waits on a webhook turns a 200ms page into an
 * indefinite one, and the reader has nothing to do here anyway.
 */

import { labels } from "../../lib/labels";
import "./welcome.css";

export function WelcomePage() {
  return (
    <main className="shell">
      <div className="welcome">
        <p className="welcome-mark">{labels.app.name}</p>
        <h1>{labels.welcome.headline}</h1>
        <p className="welcome-body">{labels.welcome.body}</p>
        <p className="welcome-quiet">{labels.welcome.password}</p>
        <a className="btn-quiet welcome-link" href="/login">{labels.welcome.login}</a>
      </div>
    </main>
  );
}
