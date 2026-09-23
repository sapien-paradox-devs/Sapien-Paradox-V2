/**
 * The four steps, and when the chapters would actually arrive at each pace
 * (#149). Dates, never a countdown (D11, D54).
 */

import { forwardRef } from "react";

import { PACE, PACE_INTERVAL_DAYS, type Pace } from "../../lib/constants";
import { labels } from "../../lib/labels";

type Props = {
  pace: Pace;
  onPace: (pace: Pace) => void;
  chapterCount: number;
};

export const HowItWorks = forwardRef<HTMLElement, Props>(function HowItWorks(
  { pace, onPace, chapterCount },
  ref,
) {
  const dates = arrivalDates(new Date(), PACE_INTERVAL_DAYS[pace], Math.min(chapterCount, 6));

  return (
    <section ref={ref} className="landing-section" aria-labelledby="landing-how">
      <h2 id="landing-how" className="landing-section-title">{labels.landing.how.title}</h2>

      <ol className="landing-steps">
        {labels.landing.how.steps.map((step, index) => (
          <li key={step.title} className="landing-step reveal">
            <span className="landing-step-n" aria-hidden="true">{index + 1}</span>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
          </li>
        ))}
      </ol>

      <div className="landing-strip reveal">
        <div className="landing-strip-head">
          <h3>{labels.landing.how.stripTitle}</h3>
          <div className="landing-pace" role="radiogroup" aria-label={labels.landing.pace}>
            {PACE.map((key) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={key === pace}
                className={key === pace ? "on" : ""}
                onClick={() => onPace(key)}
              >
                {labels.pace[key].split(" — ")[0]}
              </button>
            ))}
          </div>
        </div>

        <ol className="landing-dates">
          {dates.map((date, index) => (
            <li key={index}>
              <span className="landing-dates-n">
                {labels.landing.how.chapter} {index + 1}
              </span>
              <span className="landing-dates-day">
                {index === 0 ? labels.landing.how.today : formatDay(date)}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
});

/** The day each of the first `count` chapters would arrive, starting today. */
export function arrivalDates(start: Date, intervalDays: number, count: number): Date[] {
  return Array.from({ length: Math.max(count, 0) }, (_, index) => {
    const date = new Date(start);
    date.setDate(date.getDate() + index * intervalDays);
    return date;
  });
}

const DAY = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short" });

function formatDay(date: Date): string {
  return DAY.format(date);
}
