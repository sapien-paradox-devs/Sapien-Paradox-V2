/**
 * `/admin/login` — the admin's own door (D82). Same login endpoint as readers;
 * a non-staff account is told so here and never reaches `/admin`.
 */

import { useMachine } from "@xstate/react";
import { useEffect, useState } from "react";

import { Button } from "../../components/Button";
import { ErrorNotice } from "../../components/ErrorNotice";
import { TextField } from "../../components/TextField";
import { labels } from "../../lib/labels";
import { useNavigation } from "../useNavigation";
import { adminLoginMachine } from "./machine";
import "./admin-login.css";

export function AdminLoginPage() {
  const [state, send] = useMachine(adminLoginMachine);
  const { authenticated, navigate } = useNavigation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const user = state.context.user;
  useEffect(() => {
    if (user) authenticated(user, "/admin");
  }, [user, authenticated]);

  const submitting = state.matches("submitting");
  const edit = () => send({ type: "EDIT" });

  return (
    <main className="shell">
      <div className="admin-login">
        <p className="admin-login-eyebrow">{labels.admin.nav.label}</p>
        <h1>{labels.admin.login.title}</h1>
        <p className="admin-login-lead">{labels.admin.login.lead}</p>

        <form
          className="admin-login-form"
          onSubmit={(e) => {
            e.preventDefault();
            send({ type: "SUBMIT", email, password });
          }}
        >
          <TextField
            label={labels.login.email}
            id="admin-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              edit();
            }}
          />
          <TextField
            label={labels.login.password}
            id="admin-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              edit();
            }}
          />

          {state.context.errorMessage && <ErrorNotice>{state.context.errorMessage}</ErrorNotice>}

          {state.matches("notStaff") && (
            <ErrorNotice action={labels.admin.login.toReaderLogin} onAction={() => navigate("/")}>
              {labels.admin.login.notStaff}
            </ErrorNotice>
          )}

          <Button type="submit" disabled={submitting}>
            {submitting ? labels.login.submitting : labels.login.submit}
          </Button>
        </form>
      </div>
    </main>
  );
}
