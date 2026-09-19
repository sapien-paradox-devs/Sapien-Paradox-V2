/**
 * `/reset/:token` — where the WhatsApp "set a password" link lands.
 *
 * Reachable without a session on purpose: a reader who has never had a password
 * cannot sign in first, which is the whole reason this page exists (D26).
 *
 * Fields are ordinary component state; the machine owns the lifecycle and the
 * outcome, exactly as on the login page.
 */

import { useMachine } from "@xstate/react";
import { useState } from "react";

import { Button } from "../../components/Button";
import { ErrorNotice } from "../../components/ErrorNotice";
import { TextField } from "../../components/TextField";
import { labels } from "../../lib/labels";
import { useNavigation } from "../useNavigation";
import { resetMachine } from "./machine";
import "./reset.css";

export function ResetPage() {
  const token = window.location.pathname.split("/reset/")[1] ?? "";
  const [state, send] = useMachine(resetMachine, { input: { token } });
  const { navigate } = useNavigation();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const submitting = state.matches("submitting");
  const finished = state.matches("done");
  const dead = state.matches("dead");

  if (finished) {
    return (
      <main className="shell">
        <div className="reset">
          <p className="reset-mark">{labels.app.name}</p>
          <h1>{labels.reset.doneTitle}</h1>
          <p className="reset-lead">{labels.reset.doneBody}</p>
          <Button type="button" onClick={() => navigate("/login")}>
            {labels.reset.toLogin}
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="shell">
      <div className="reset">
        <p className="reset-mark">{labels.app.name}</p>
        <h1>{labels.reset.title}</h1>
        <p className="reset-lead">{labels.reset.lead}</p>

        {dead ? (
          <>
            <ErrorNotice>{state.context.errorMessage}</ErrorNotice>
            <Button type="button" onClick={() => navigate("/login")}>
              {labels.reset.toLogin}
            </Button>
          </>
        ) : (
          <form
            className="reset-form"
            onSubmit={(e) => {
              e.preventDefault();
              send({ type: "SUBMIT", password, confirm });
            }}
          >
            <TextField
              label={labels.reset.password}
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                send({ type: "EDIT" });
              }}
            />

            <TextField
              label={labels.reset.confirm}
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                send({ type: "EDIT" });
              }}
            />

            <p className="reset-hint">{labels.reset.hint}</p>

            {state.context.errorMessage && (
              <ErrorNotice>{state.context.errorMessage}</ErrorNotice>
            )}

            <Button type="submit" disabled={submitting}>
              {submitting ? labels.reset.submitting : labels.reset.submit}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
