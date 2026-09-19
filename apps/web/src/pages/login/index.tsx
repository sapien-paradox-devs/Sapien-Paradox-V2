/**
 * The login page. Fields are ordinary component state; the machine owns the
 * lifecycle — idle, submitting, error — and the outcome.
 */

import { useMachine } from "@xstate/react";
import { useEffect, useState } from "react";

import { Button } from "../../components/Button";
import { ErrorNotice } from "../../components/ErrorNotice";
import { TextField } from "../../components/TextField";
import { labels } from "../../lib/labels";
import { useNavigation } from "../useNavigation";
import { loginMachine } from "./machine";
import "./login.css";

export function LoginPage() {
  const [state, send] = useMachine(loginMachine);
  const { authenticated } = useNavigation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const user = state.context.user;

  useEffect(() => {
    if (user) authenticated(user);
  }, [user, authenticated]);

  const submitting = state.matches("submitting");

  return (
    <main className="shell">
      <div className="login">
        <p className="login-mark">{labels.app.name}</p>
        <h1>{labels.login.title}</h1>

        <form
          className="login-form"
          onSubmit={(e) => {
            e.preventDefault();
            send({ type: "SUBMIT", email, password });
          }}
        >
          <TextField
            label={labels.login.email}
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              send({ type: "EDIT" });
            }}
          />

          <TextField
            label={labels.login.password}
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              send({ type: "EDIT" });
            }}
          />

          {state.context.errorMessage && (
            <ErrorNotice>{state.context.errorMessage}</ErrorNotice>
          )}

          <Button type="submit" disabled={submitting}>
            {submitting ? labels.login.submitting : labels.login.submit}
          </Button>
        </form>
      </div>
    </main>
  );
}
