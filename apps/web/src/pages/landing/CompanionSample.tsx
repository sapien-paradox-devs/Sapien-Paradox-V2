/**
 * A short example of the companion at work (#149). Static copy from labels —
 * showing the tone does more than describing it (D13).
 */

import { labels } from "../../lib/labels";

export function CompanionSample() {
  const sample = labels.landing.sample;

  return (
    <section className="landing-section landing-sample" aria-labelledby="landing-sample">
      <h2 id="landing-sample" className="landing-section-title">{sample.title}</h2>
      <p className="landing-sample-lede">{sample.lede}</p>

      <ol className="landing-exchange">
        {sample.exchange.map((turn, index) => (
          <li key={index} className={`landing-turn landing-turn-${turn.from} reveal`}>
            <span className="landing-turn-who">
              {turn.from === "companion" ? sample.companion : sample.reader}
            </span>
            <p>{turn.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
