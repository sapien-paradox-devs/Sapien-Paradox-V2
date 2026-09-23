/**
 * The landing page — level 2. Renders the machine's state and nothing else (D15).
 *
 * The only page an anonymous visitor sees at `/`. Paying is what creates a
 * reader (D47), so this form is the front door.
 */

import { useMachine } from "@xstate/react";
import { useState } from "react";

import { labels } from "../../lib/labels";
import { PACE } from "../../lib/constants";
import { useNavigation } from "../useNavigation";
import { landingMachine } from "./machine";
import "./landing.css";

const rupees = (minorUnits: number) =>
  `₹${(minorUnits / 100).toLocaleString("en-IN")}`;

export function LandingPage() {
  const [state, send] = useMachine(landingMachine);
  const { navigate } = useNavigation();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [pace, setPace] = useState<string>(PACE[1]);

  const books = state.context.books;
  const book = books[0] ?? null;
  const busy = state.matches("submitting") || state.matches("redirecting");

  if (state.matches("loading")) {
    return <main className="shell"><p className="landing-quiet">{labels.landing.loading}</p></main>;
  }

  if (state.matches("failed")) {
    return (
      <main className="shell">
        <div className="landing-quiet">
          <p>{labels.landing.error}</p>
          <button className="btn-quiet" onClick={() => send({ type: "RETRY" })}>
            {labels.landing.retry}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="landing">
      <section className="landing-lede">
        <h1>{labels.landing.headline}</h1>
        <p className="landing-sub">{labels.landing.subhead}</p>

        <ol className="landing-how">
          {labels.landing.how.map((step) => <li key={step}>{step}</li>)}
        </ol>

        {/*
          A reader who has already set a password arrives here, not at /login —
          `/` is the landing page for anyone without a session. Without this the
          only routes to sign-in are /welcome and the set-password link, both
          seen once, so coming back means typing the URL by hand.
        */}
        <p className="landing-signin">
          {labels.landing.haveAccount}{" "}
          <button type="button" className="linklike" onClick={() => navigate("/login")}>
            {labels.landing.signIn}
          </button>
        </p>
      </section>

      <section className="landing-buy">
        {book === null ? (
          <p className="landing-quiet">{labels.landing.nothingForSale}</p>
        ) : (
          <form
            className="landing-form"
            onSubmit={(e) => {
              e.preventDefault();
              send({
                type: "SUBMIT",
                signup: { fullName, email, phone, bookSlug: book.slug, pace },
              });
            }}
          >
            <div className="landing-book">
              <h2>{book.title}</h2>
              <p className="landing-meta">
                {book.chapterCount} {labels.landing.chapters} · {rupees(book.priceMinorUnits)}
              </p>
            </div>

            <div className="field">
              <label htmlFor="fullName">{labels.landing.name}</label>
              <input id="fullName" required value={fullName}
                     onChange={(e) => setFullName(e.target.value)} />
            </div>

            <div className="field">
              <label htmlFor="email">{labels.landing.email}</label>
              <input id="email" type="email" required value={email}
                     onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div className="field">
              <label htmlFor="phone">{labels.landing.phone}</label>
              <input id="phone" required placeholder="+91" value={phone}
                     onChange={(e) => setPhone(e.target.value)} />
              <span className="landing-hint">{labels.landing.phoneHint}</span>
            </div>

            <div className="field">
              <label htmlFor="pace">{labels.landing.pace}</label>
              <select id="pace" value={pace} onChange={(e) => setPace(e.target.value)}>
                {PACE.map((key) => (
                  <option key={key} value={key}>{labels.pace[key]}</option>
                ))}
              </select>
            </div>

            {state.matches("refused") && (
              <p className="notice">{labels.landing.refused}</p>
            )}

            <button className="btn" type="submit" disabled={busy}>
              {busy ? labels.landing.sending : `${labels.landing.buy} ${rupees(book.priceMinorUnits)}`}
            </button>

            <p className="landing-fineprint">{labels.landing.fineprint}</p>
          </form>
        )}
      </section>
    </main>
  );
}
