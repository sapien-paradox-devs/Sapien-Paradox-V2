/**
 * `/read/:chapterId` — swaps a chapter for a token and redirects.
 *
 * Waits for the session region to settle before deciding anything (D44). This
 * is the one sanctioned place a page reads level 0.
 */

import { useMachine } from "@xstate/react";
import { useEffect } from "react";

import { labels } from "../../lib/labels";
import { useNavigation } from "../useNavigation";
import { openingMachine } from "./machine";

export function OpeningPage() {
  // Read from the URL here, not passed down: the root machine holds no domain
  // objects, and a `chapterId` in its context is the level-1 leakage D15 warns
  // about.
  const chapterId = window.location.pathname.split("/read/")[1] ?? "";

  const { user, sessionSettled, navigate } = useNavigation();
  const [state, send] = useMachine(openingMachine, { input: { chapterId } });

  useEffect(() => {
    if (sessionSettled) {
      send({ type: "SESSION_SETTLED", authenticated: user !== null });
    }
  }, [sessionSettled, user, send]);

  const token = state.context.token;

  useEffect(() => {
    if (token) navigate(`/r/${token}`);
  }, [token, navigate]);

  useEffect(() => {
    if (state.matches("anonymous")) navigate("/login");
  }, [state, navigate]);

  if (state.matches("denied")) {
    return <main role="alert">{labels.opening.denied}</main>;
  }

  if (state.matches("error")) {
    return (
      <main role="alert">
        {labels.opening.error}{" "}
        <button onClick={() => send({ type: "RETRY" })}>
          {labels.opening.retry}
        </button>
      </main>
    );
  }

  return <main>{labels.opening.working}</main>;
}
