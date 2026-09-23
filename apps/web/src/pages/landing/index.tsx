/**
 * The landing page — the idea before the product (#149).
 *
 * The only page an anonymous visitor sees at `/`. It tells the story and asks
 * for nothing; *Begin a book* goes to `/begin`, which does the buying on a page
 * of its own (#160). No async work here, so no machine (apps/web/CLAUDE.md).
 */

import { useRef, useState } from "react";

import { labels } from "../../lib/labels";
import { PACE, type Pace } from "../../lib/constants";
import { useNavigation } from "../useNavigation";
import { CompanionSample } from "./CompanionSample";
import { Faq } from "./Faq";
import { Hero } from "./Hero";
import { HowItWorks } from "./HowItWorks";
import { Idea } from "./Idea";
import "./landing.css";

/** How many chapters' arrival dates the strip shows. */
const STRIP_CHAPTERS = 5;

export function LandingPage() {
  const { navigate } = useNavigation();
  // The pace chosen on the strip travels to `/begin` (#160).
  const [pace, setPace] = useState<Pace>(PACE[1]);
  const howRef = useRef<HTMLElement>(null);

  const begin = () => navigate(`/begin?pace=${pace}`);

  return (
    <main className="landing">
      <Hero onBegin={begin} onHow={() => scrollTo(howRef.current)} />

      <Idea />

      <HowItWorks ref={howRef} pace={pace} onPace={setPace} chapterCount={STRIP_CHAPTERS} />

      <CompanionSample />

      <section className="landing-section landing-cta" aria-labelledby="landing-begin">
        <h2 id="landing-begin" className="landing-cta-title">{labels.landing.beginTitle}</h2>
        <p className="landing-sub">{labels.landing.beginLede}</p>
        <button type="button" className="btn" onClick={begin}>
          {labels.landing.begin}
        </button>
      </section>

      <Faq />
    </main>
  );
}

/**
 * A button, not a `#hash` link: a fragment navigation fires popstate, which the
 * router would read as a page change (D15).
 */
function scrollTo(target: HTMLElement | null) {
  if (!target) return;
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
}
