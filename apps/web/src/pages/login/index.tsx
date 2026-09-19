/**
 * The login page. Fields are ordinary component state; the machine owns the
 * lifecycle — idle, submitting, error — and the outcome.
 */

import { useMachine } from "@xstate/react";
import { useEffect, useState } from "react";

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
    <main className="login">
      <h1>{labels.login.title}</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send({ type: "SUBMIT", email, password });
        }}
      >
        <label htmlFor="email">{labels.login.email}</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            send({ type: "EDIT" });
          }}
        />

        <label htmlFor="password">{labels.login.password}</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            send({ type: "EDIT" });
          }}
        />

        {state.context.errorMessage && (
          <p role="alert">{state.context.errorMessage}</p>
        )}

        <button type="submit" disabled={submitting}>
          {submitting ? labels.login.submitting : labels.login.submit}
        </button>
      </form>
    </main>
  );
}
