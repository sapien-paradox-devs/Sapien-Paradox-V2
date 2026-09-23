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

import { labels } from "../../lib/labels";
import { PACE, type Pace } from "../../lib/constants";
import { useNavigation } from "../useNavigation";
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
    return <main className="shell"><p className="begin-quiet">{labels.begin.loading}</p></main>;
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

  return (
    <main className="shell">
      <div className="begin">
        <h1>{labels.begin.title}</h1>
        <p className="begin-lede">{labels.begin.lede}</p>

        {book === null ? (
          <p className="begin-quiet">{labels.begin.nothingForSale}</p>
        ) : (
          <form
            className="begin-form"
            onSubmit={(e) => {
              e.preventDefault();
              send({
                type: "SUBMIT",
                signup: { fullName, email, phone, bookSlug: book.slug, pace },
              });
            }}
          >
            <div className="begin-book">
              <h2>{book.title}</h2>
              <p className="begin-meta">
                {book.chapterCount} {labels.begin.chapters} · {rupees(book.priceMinorUnits)}
              </p>
            </div>

            <div className="field">
              <label htmlFor="fullName">{labels.begin.name}</label>
              <input id="fullName" required value={fullName}
                     onChange={(e) => setFullName(e.target.value)} />
            </div>

            <div className="field">
              <label htmlFor="email">{labels.begin.email}</label>
              <input id="email" type="email" required value={email}
                     onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div className="field">
              <label htmlFor="phone">{labels.begin.phone}</label>
              <input id="phone" required placeholder="+91" value={phone}
                     onChange={(e) => setPhone(e.target.value)} />
              <span className="begin-hint">{labels.begin.phoneHint}</span>
            </div>

            <div className="field">
              <label htmlFor="pace">{labels.begin.pace}</label>
              <select id="pace" value={pace} onChange={(e) => setPace(paceFrom(e.target.value))}>
                {PACE.map((key) => (
                  <option key={key} value={key}>{labels.pace[key]}</option>
                ))}
              </select>
            </div>

            {state.matches("refused") && (
              <p className="notice">{labels.begin.refused}</p>
            )}

            <button className="btn" type="submit" disabled={busy}>
              {busy ? labels.begin.sending : `${labels.begin.buy} ${rupees(book.priceMinorUnits)}`}
            </button>

            <p className="begin-fineprint">{labels.begin.fineprint}</p>
          </form>
        )}

        <p className="begin-signin">
          {labels.begin.haveAccount}{" "}
          <button type="button" className="linklike" onClick={() => navigate("/login")}>
            {labels.begin.signIn}
          </button>
        </p>
      </div>
    </main>
  );
}
