/**
 * The first screen a stranger sees: the idea, before the product (#149).
 * No form here — asking for money before explaining anything is what this
 * page replaced.
 */

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
      <BookIllustration />
    </section>
  );
}

/**
 * The open book from the share card (apps/web/brand/og-default.html), drawn
 * with theme tokens so it sits on paper in both light and dark.
 */
function BookIllustration() {
  return (
    <svg className="landing-book-art" viewBox="0 0 420 360" role="img"
      aria-label={labels.landing.illustration}>
      <g fill="none" stroke="var(--rule)" strokeWidth="2">
        <path d="M22 70 L22 312 C90 298 160 304 210 330 C260 304 330 298 398 312 L398 70" />
        <path d="M16 76 L16 320 C88 305 160 312 210 338 C260 312 332 305 404 320 L404 76" />
      </g>
      <g fill="var(--paper-raised)" stroke="var(--rule)" strokeWidth="2">
        <path d="M206 44 C156 18 90 10 28 20 L28 300 C92 290 156 296 206 324 Z" />
        <path d="M214 44 C264 18 330 10 392 20 L392 300 C328 290 264 296 214 324 Z" />
      </g>
      <g stroke="var(--rule)" strokeWidth="3" strokeLinecap="round" fill="none">
        <path d="M58 82 C100 76 150 80 184 92" />
        <path d="M58 112 C100 106 150 110 184 122" />
        <path d="M58 142 C100 136 150 140 184 152" />
        <path d="M58 172 C100 166 150 170 184 182" />
        <path d="M58 202 C100 196 150 200 184 212" />
        <path d="M58 232 C100 226 140 229 160 236" />
        <path d="M240 172 C270 164 320 160 364 164" />
        <path d="M240 202 C270 194 320 190 364 194" />
        <path d="M240 232 C270 224 320 220 364 224" />
        <path d="M240 262 C262 256 290 253 310 254" />
      </g>
      <text x="303" y="112" textAnchor="middle" className="landing-book-numeral">I</text>
      <path d="M283 132 L323 132" stroke="var(--accent)" strokeWidth="2" />
      <path className="landing-book-ribbon" d="M332 14 L352 11 L352 350 L342 338 L332 352 Z" fill="var(--accent)" />
    </svg>
  );
}
