/**
 * The login page. Fields are ordinary component state; the machine owns the
 * lifecycle — idle, submitting, error — and the outcome.
 */

import { useMachine } from "@xstate/react";
import { useEffect, useState } from "react";

import { AuthLayout } from "../../components/AuthLayout";
import { Button } from "../../components/Button";
import { ErrorNotice } from "../../components/ErrorNotice";
import { TextField } from "../../components/TextField";
import { labels } from "../../lib/labels";
import { useNavigation } from "../useNavigation";
import { loginMachine } from "./machine";
import "./login.css";

export function LoginPage() {
  const [state, send] = useMachine(loginMachine);
  const { authenticated, navigate } = useNavigation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const user = state.context.user;

  useEffect(() => {
    if (user) authenticated(user);
  }, [user, authenticated]);

  const submitting = state.matches("submitting");
  const sendingLink = state.matches("sendingLink");

  // A reader who never set a password cannot be helped by the form above, so
  // the whole page becomes the link request rather than growing a second form
  // beneath one that cannot work for them.
  if (state.matches("linkForm") || sendingLink || state.matches("linkSent")) {
    return (
      <AuthLayout eyebrow={labels.auth.signInEyebrow} title={labels.auth.signInTitle} lede={labels.auth.signInLede}>
        <div className="auth-card">
          <h1>{labels.login.linkTitle}</h1>

          {state.matches("linkSent") ? (
            <>
              <p className="auth-sub">{labels.login.linkDone}</p>
              <Button type="button" onClick={() => send({ type: "BACK" })}>
                {labels.login.linkBack}
              </Button>
            </>
          ) : (
            <form
              className="auth-form"
              onSubmit={(e) => {
                e.preventDefault();
                send({ type: "SEND_LINK", phone });
              }}
            >
              <p className="auth-sub">{labels.login.linkLead}</p>

              <TextField
                label={labels.login.linkPhone}
                id="phone"
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  send({ type: "EDIT" });
                }}
              />

              {state.context.errorMessage && (
                <ErrorNotice>{state.context.errorMessage}</ErrorNotice>
              )}

              <Button type="submit" disabled={sendingLink}>
                {sendingLink ? labels.login.linkSending : labels.login.linkSubmit}
              </Button>

              <button
                type="button"
                className="linklike"
                onClick={() => send({ type: "BACK" })}
              >
                {labels.login.linkBack}
              </button>
            </form>
          )}
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout eyebrow={labels.auth.signInEyebrow} title={labels.auth.signInTitle} lede={labels.auth.signInLede}>
      <div className="auth-card">
        <h1>{labels.login.title}</h1>
        <p className="auth-sub">{labels.login.sub}</p>

        <form
          className="auth-form"
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

          <div className="auth-password">
            <TextField
              label={labels.login.password}
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                send({ type: "EDIT" });
              }}
            />
            <button type="button" className="auth-reveal" aria-pressed={showPassword}
              onClick={() => setShowPassword((shown) => !shown)}>
              {showPassword ? labels.login.hidePassword : labels.login.showPassword}
            </button>
          </div>

          {state.context.errorMessage && (
            <ErrorNotice>{state.context.errorMessage}</ErrorNotice>
          )}

          <Button type="submit" disabled={submitting}>
            {submitting ? labels.login.submitting : labels.login.submit}
          </Button>
        </form>

        <p className="auth-small">
          {labels.login.noPassword}{" "}
          <button
            type="button"
            className="linklike"
            onClick={() => send({ type: "REQUEST_LINK" })}
          >
            {labels.login.sendLink}
          </button>
        </p>

        <p className="auth-divider">{labels.login.newHere}</p>
        <button type="button" className="auth-secondary" onClick={() => navigate("/begin")}>
          {labels.login.createAccount}
        </button>
      </div>
    </AuthLayout>
  );
}
