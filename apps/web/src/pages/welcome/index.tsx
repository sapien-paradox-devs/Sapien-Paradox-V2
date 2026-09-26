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
import type { ResendOutcome } from "./machine";
import { welcomeMachine } from "./machine";

/** Say which messages actually left, rather than a bare "done". */
function resendMessage(outcome: ResendOutcome): string {
  if (outcome.status === "throttled") return labels.welcome.resentThrottled;
  if (!outcome.chapterSent) return labels.welcome.resentFailed;
  return outcome.passwordSent ? labels.welcome.resentBoth : labels.welcome.resentChapter;
}
import "./welcome.css";

export function WelcomePage() {
  const [state, send] = useMachine(welcomeMachine);
  const { navigate } = useNavigation();

  const resending = state.matches("resending");

  // Offered wherever the reader might still be waiting on a message — which is
  // every outcome except a refusal, where sending again cannot help.
  const resend = (
    <>
      {state.context.resend && (
        <p className="welcome-quiet">{resendMessage(state.context.resend)}</p>
      )}
      <button
        type="button"
        className="btn-quiet welcome-link"
        onClick={() => send({ type: "RESEND" })}
        disabled={resending}
      >
        {resending ? labels.welcome.resending : labels.welcome.resend}
      </button>
    </>
  );

  const signIn = (
    <button type="button" className="btn-quiet welcome-link" onClick={() => navigate("/login")}>
      {labels.welcome.login}
    </button>
  );

  if (state.matches("confirming")) {
    return (
      <main className="shell">
        <div className="welcome">
          <Spinner label={labels.welcome.confirming} />
          <p className="welcome-body">{labels.welcome.confirming}</p>
        </div>
      </main>
    );
  }

  if (state.matches("fulfilled") || state.matches("resending") || state.matches("resent")) {
    const { delivered, hasPhone } = state.context;
    return (
      <main className="shell">
        <div className="welcome">
          {!hasPhone ? (
            <>
              <h1>{labels.welcome.headline}</h1>
              <p className="welcome-body">{labels.welcome.noPhoneBody}</p>
            </>
          ) : (
            <>
              <h1>{delivered ? labels.welcome.headline : labels.welcome.sentButUndelivered}</h1>
              <p className="welcome-body">
                {delivered ? labels.welcome.body : labels.welcome.sandboxNote}
              </p>
              <p className="welcome-quiet">{labels.welcome.password}</p>
              {resend}
            </>
          )}
          {signIn}
        </div>
      </main>
    );
  }

  if (state.matches("owned")) {
    return (
      <main className="shell">
        <div className="welcome">
          <h1>{labels.welcome.ownedTitle}</h1>
          <p className="welcome-body">{labels.welcome.alreadyOwned}</p>
          {resend}
          {signIn}
        </div>
      </main>
    );
  }

  if (state.matches("pending")) {
    return (
      <main className="shell">
        <div className="welcome">
          <h1>{labels.welcome.pendingTitle}</h1>
          <p className="welcome-body">{labels.welcome.pendingBody}</p>
          {resend}
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
        <h1>{labels.welcome.failedTitle}</h1>
        <p className="welcome-body">{labels.welcome.failedBody}</p>
        {resend}
        {signIn}
      </div>
    </main>
  );
}
