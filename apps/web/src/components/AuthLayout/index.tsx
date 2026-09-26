/**
 * The sign-in and sign-up pages' frame (#206): the book and what reading here
 * is like on one side, the form on the other. On a phone the panel becomes a
 * short banner above the form. Render props only (D15).
 */

import type { ReactNode } from "react";

import { labels } from "../../lib/labels";
import { BookIllustration } from "../BookIllustration";
import "./AuthLayout.css";

type Props = {
  eyebrow: string;
  title: string;
  lede: string;
  children: ReactNode;
};

const ICONS = [
  // WhatsApp-style bubble: a chapter arrives
  <path key="a" d="M4 5.5A2.5 2.5 0 0 1 6.5 3h7A2.5 2.5 0 0 1 16 5.5v5a2.5 2.5 0 0 1-2.5 2.5H9l-3.5 3v-3A2.5 2.5 0 0 1 4 10.5z" />,
  // An open page: the quiet room
  <path key="b" d="M3 5c2.5-1 5-1 7 .5C12 4 14.5 4 17 5v10c-2.5-1-5-1-7 .5C8 14 5.5 14 3 15z M10 5.5v10" />,
  // A question mark in a circle: the companion asks
  <path key="c" d="M10 17.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15z M8 8a2 2 0 1 1 2.8 1.8c-.5.3-.8.7-.8 1.2v.5 M10 14h.01" />,
];

export function AuthLayout({ eyebrow, title, lede, children }: Props) {
  return (
    <main className="auth">
      <aside className="auth-panel">
        <p className="auth-eyebrow">{eyebrow}</p>
        <h2 className="auth-title">{title}</h2>
        <p className="auth-lede">{lede}</p>
        <BookIllustration className="auth-art" />
        <ul className="auth-points">
          {labels.auth.points.map((point, index) => (
            <li key={point}>
              <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor"
                strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                {ICONS[index % ICONS.length]}
              </svg>
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </aside>
      <section className="auth-main">{children}</section>
    </main>
  );
}
