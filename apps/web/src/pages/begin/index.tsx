/**
 * `/begin` — buying a book, on its own page (#160).
 *
 * The landing page tells the story; this page does one thing, like `/login`:
 * a centred card with the book, the reader's details, the pace and payment.
 * Paying is what creates a reader (D47). The machine is the checkout flow that
 * used to live on the landing page, moved here unchanged.
 */

import { useMachine } from "@xstate/react";
import { useState } from "react";

import { AuthLayout } from "../../components/AuthLayout";
import { labels } from "../../lib/labels";
import { PACE, PACE_INTERVAL_DAYS, type Pace } from "../../lib/constants";
import { useNavigation } from "../useNavigation";
import { BeginSkeleton } from "./BeginSkeleton";
import { beginMachine } from "./machine";
import { bookFrom, paceFrom } from "./params";
import "./begin.css";

const rupees = (minorUnits: number) =>
  `₹${(minorUnits / 100).toLocaleString("en-IN")}`;

export function BeginPage() {
  const [state, send] = useMachine(beginMachine);
  const { navigate } = useNavigation();

  // Read once: the query string is where the landing page or the catalogue
  // left the reader's choices, not something that changes while here.
  const [params] = useState(() => new URLSearchParams(window.location.search));

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [pace, setPace] = useState<Pace>(() => paceFrom(params.get("pace")));

  const book = bookFrom(state.context.books, params.get("book"));
  const busy = state.matches("submitting") || state.matches("redirecting");

  if (state.matches("loading")) {
    return <BeginSkeleton />;
  }

  if (state.matches("failed")) {
    return (
      <main className="shell">
        <div className="begin-quiet">
          <p>{labels.begin.error}</p>
          <button className="btn-quiet" onClick={() => send({ type: "RETRY" })}>
            {labels.begin.retry}
          </button>
        </div>
      </main>
    );
  }

  const days = book ? PACE_INTERVAL_DAYS[pace] * Math.max(book.chapterCount - 1, 0) + 1 : 0;

  return (
    <AuthLayout eyebrow={labels.auth.signUpEyebrow} title={labels.auth.signUpTitle} lede={labels.auth.signUpLede}>
      <div className="auth-card begin-card">
        <ol className="begin-steps" aria-label={labels.begin.stepsLabel}>
          {labels.begin.steps.map((step, index) => (
            <li key={step} aria-current={index === 0 ? "step" : undefined}>
              <span className="begin-step-n">{index + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>

        <h1>{labels.begin.title}</h1>
        <p className="auth-sub">{labels.begin.lede}</p>

        {book === null ? (
          <p className="begin-quiet">{labels.begin.nothingForSale}</p>
        ) : (
          <form
            className="auth-form"
            onSubmit={(e) => {
              e.preventDefault();
              send({
                type: "SUBMIT",
                signup: { fullName, email, phone, bookSlug: book.slug, pace },
              });
            }}
          >
            <div className="begin-book">
              <span className="begin-cover" aria-hidden="true">{book.title}</span>
              <div>
                <p className="begin-book-title">{book.title}</p>
                <p className="begin-meta">
                  {book.chapterCount} {labels.begin.chapters} · {rupees(book.priceMinorUnits)}
                </p>
              </div>
            </div>

            <div className="field">
              <label htmlFor="fullName">{labels.begin.name}</label>
              <input id="fullName" required autoComplete="name" value={fullName}
                     onChange={(e) => setFullName(e.target.value)} />
            </div>

            <div className="begin-pair">
              <div className="field">
                <label htmlFor="email">{labels.begin.email}</label>
                <input id="email" type="email" required autoComplete="email" value={email}
                       onChange={(e) => setEmail(e.target.value)} />
              </div>

              <div className="field">
                <label htmlFor="phone">{labels.begin.phone}</label>
                <input id="phone" type="tel" required autoComplete="tel" placeholder="+91" value={phone}
                       onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>
            <span className="begin-hint">{labels.begin.phoneHint}</span>

            <fieldset className="begin-pace">
              <legend>{labels.begin.pace}</legend>
              <div className="begin-pace-options">
                {PACE.map((key) => (
                  <label key={key} className="begin-pace-option">
                    <input type="radio" name="pace" value={key} checked={pace === key}
                      onChange={() => setPace(key)} />
                    <span className="begin-pace-name">{labels.begin.paceCards[key].name}</span>
                    <span className="begin-pace-detail">{labels.begin.paceCards[key].detail}</span>
                  </label>
                ))}
              </div>
              <p className="begin-hint">{labels.begin.finishIn.replace("{n}", String(days))}</p>
            </fieldset>

            <div className="begin-total">
              <div>
                <p className="begin-total-label">{labels.begin.total}</p>
                <p className="begin-hint">{labels.begin.once}</p>
              </div>
              <p className="begin-total-amount">{rupees(book.priceMinorUnits)}</p>
            </div>

            {state.matches("refused") && (
              <p className="notice">{labels.begin.refused}</p>
            )}

            <button className="btn" type="submit" disabled={busy}>
              {busy ? labels.begin.sending : labels.begin.buy}
            </button>

            <p className="begin-fineprint">
              <svg viewBox="0 0 20 20" width="13" height="13" aria-hidden="true" fill="none" stroke="currentColor"
                strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4.5" y="9" width="11" height="8" rx="1.5" />
                <path d="M7 9V6.5a3 3 0 0 1 6 0V9" />
              </svg>
              {labels.begin.fineprint}
            </p>
          </form>
        )}

        <p className="auth-divider">{labels.begin.haveAccount}</p>
        <button type="button" className="auth-secondary" onClick={() => navigate("/login")}>
          {labels.begin.signIn}
        </button>
      </div>
    </AuthLayout>
  );
}
