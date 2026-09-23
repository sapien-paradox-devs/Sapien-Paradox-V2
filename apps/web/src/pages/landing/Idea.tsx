/** The three principles the product is built on (#149). */

import { labels } from "../../lib/labels";

export function Idea() {
  return (
    <section className="landing-section" aria-labelledby="landing-idea">
      <h2 id="landing-idea" className="landing-section-title">{labels.landing.idea.title}</h2>
      <ol className="landing-ideas">
        {labels.landing.idea.items.map((item, index) => (
          <li key={item.title} className="landing-idea reveal">
            <span className="landing-idea-n" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            <h3>{item.title}</h3>
            <p>{item.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
