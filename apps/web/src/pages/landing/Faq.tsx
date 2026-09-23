/** Questions a stranger has before paying (#149). Native <details>: no JS. */

import { labels } from "../../lib/labels";

export function Faq() {
  return (
    <section className="landing-section" aria-labelledby="landing-faq">
      <h2 id="landing-faq" className="landing-section-title">{labels.landing.faq.title}</h2>
      <div className="landing-faq">
        {labels.landing.faq.items.map((item) => (
          <details key={item.q}>
            <summary>{item.q}</summary>
            <p>{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
