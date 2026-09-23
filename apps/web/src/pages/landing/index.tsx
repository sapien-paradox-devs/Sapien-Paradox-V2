/**
 * The landing page — level 2. Renders the machine's state and nothing else (D15).
 *
 * The only page an anonymous visitor sees at `/`. Paying is what creates a
 * reader (D47) — but a stranger has to understand the idea before the form
 * means anything, so the page leads with it and the form comes after (#149).
 */

import { useMachine } from "@xstate/react";
import { useRef, useState } from "react";

import { labels } from "../../lib/labels";
import { PACE, type Pace } from "../../lib/constants";
import { useNavigation } from "../useNavigation";
import { CompanionSample } from "./CompanionSample";
import { Faq } from "./Faq";
import { Hero } from "./Hero";
import { HowItWorks } from "./HowItWorks";
import { Idea } from "./Idea";
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
  // Shared by the "when would chapters arrive" strip and the form, so choosing
  // a pace in one shows in the other.
  const [pace, setPace] = useState<Pace>(PACE[1]);

  const howRef = useRef<HTMLElement>(null);
  const beginRef = useRef<HTMLElement>(null);

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
      <Hero onBegin={() => scrollTo(beginRef.current)} onHow={() => scrollTo(howRef.current)} />

      <Idea />

      <HowItWorks
        ref={howRef}
        pace={pace}
        onPace={setPace}
        chapterCount={book?.chapterCount ?? 5}
      />

      <CompanionSample />

      <section ref={beginRef} className="landing-section landing-begin" aria-labelledby="landing-begin">
        <div className="landing-begin-words">
          <h2 id="landing-begin" className="landing-section-title">{labels.landing.beginTitle}</h2>
          <p className="landing-sub">{labels.landing.beginLede}</p>

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
        </div>

        <div className="landing-buy">
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
                <h3>{book.title}</h3>
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
                <select id="pace" value={pace} onChange={(e) => setPace(paceFrom(e.target.value))}>
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
        </div>
      </section>

      <Faq />
    </main>
  );
}

/** A select's value back to a Pace, without a cast. Unknown values keep the default. */
function paceFrom(value: string): Pace {
  return PACE.find((key) => key === value) ?? PACE[1];
}

/**
 * Buttons, not `#hash` links: a fragment navigation fires popstate, which the
 * router would read as a page change (D15).
 */
function scrollTo(target: HTMLElement | null) {
  if (!target) return;
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
}
