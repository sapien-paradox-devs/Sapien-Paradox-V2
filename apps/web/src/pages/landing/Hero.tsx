/**
 * The first screen a stranger sees: the idea, before the product (#149).
 * No form here — asking for money before explaining anything is what this
 * page replaced.
 */

import { BookIllustration } from "../../components/BookIllustration";
import { labels } from "../../lib/labels";

export function Hero({ onBegin, onHow }: { onBegin: () => void; onHow: () => void }) {
  return (
    <section className="landing-hero">
      <div className="landing-hero-words">
        <p className="landing-eyebrow">{labels.landing.eyebrow}</p>
        <h1>{labels.landing.headline}</h1>
        <p className="landing-sub">{labels.landing.subhead}</p>
        <div className="landing-hero-actions">
          <button type="button" className="btn" onClick={onBegin}>
            {labels.landing.begin}
          </button>
          <button type="button" className="linklike" onClick={onHow}>
            {labels.landing.howLink}
          </button>
        </div>
      </div>
      <BookIllustration className="landing-book-art" />
    </section>
  );
}
