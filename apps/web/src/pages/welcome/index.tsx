/**
 * Where Razorpay sends the reader back (D47), and where the purchase is actually
 * fulfilled (D48).
 *
 * This page used to say almost nothing and call nobody — which meant it told a
 * reader their chapter was on its way while a rejected webhook had created
 * nothing. Now it confirms, and says what is true of each outcome.
 */

import { useMachine } from "@xstate/react";

import { Spinner } from "../../components/Spinner";
import { labels } from "../../lib/labels";
import { useNavigation } from "../useNavigation";
import { welcomeMachine } from "./machine";
import "./welcome.css";

export function WelcomePage() {
  const [state] = useMachine(welcomeMachine);
  const { navigate } = useNavigation();

  const signIn = (
    <button type="button" className="btn-quiet welcome-link" onClick={() => navigate("/login")}>
      {labels.welcome.login}
    </button>
  );

  if (state.matches("confirming")) {
    return (
      <main className="shell">
        <div className="welcome">
          <p className="welcome-mark">{labels.app.name}</p>
          <Spinner label={labels.welcome.confirming} />
          <p className="welcome-body">{labels.welcome.confirming}</p>
        </div>
      </main>
    );
  }

  if (state.matches("fulfilled")) {
    // `delivered` is whether the chapter message actually left. Saying it is on
    // its way when Twilio refused it is the lie this page used to tell.
    const delivered = state.context.delivered;
    return (
      <main className="shell">
        <div className="welcome">
          <p className="welcome-mark">{labels.app.name}</p>
          <h1>{delivered ? labels.welcome.headline : labels.welcome.sentButUndelivered}</h1>
          <p className="welcome-body">
            {delivered ? labels.welcome.body : labels.welcome.sandboxNote}
          </p>
          <p className="welcome-quiet">{labels.welcome.password}</p>
          {signIn}
        </div>
      </main>
    );
  }

  if (state.matches("pending")) {
    return (
      <main className="shell">
        <div className="welcome">
          <p className="welcome-mark">{labels.app.name}</p>
          <h1>{labels.welcome.pendingTitle}</h1>
          <p className="welcome-body">{labels.welcome.pendingBody}</p>
          {signIn}
        </div>
      </main>
    );
  }

  if (state.matches("refused")) {
    const owned = state.context.detail === "already_owns_book";
    return (
      <main className="shell">
        <div className="welcome">
          <p className="welcome-mark">{labels.app.name}</p>
          <h1>{labels.welcome.refusedTitle}</h1>
          <p className="welcome-body">
            {owned ? labels.welcome.alreadyOwned : labels.welcome.refusedBody}
          </p>
          {signIn}
        </div>
      </main>
    );
  }

  return (
    <main className="shell">
      <div className="welcome">
        <p className="welcome-mark">{labels.app.name}</p>
        <h1>{labels.welcome.failedTitle}</h1>
        <p className="welcome-body">{labels.welcome.failedBody}</p>
        {signIn}
      </div>
    </main>
  );
}
