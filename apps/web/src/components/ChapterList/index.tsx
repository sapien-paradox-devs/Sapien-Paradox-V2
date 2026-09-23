/**
 * The chapters of one book.
 *
 * Progress is shown quietly (D70, reversing D11's "no progress bars"): a small
 * ring per chapter, and a check with "Completed" once the reader has marked it
 * so. No percentages on the rows, no badges, nothing that turns reading into a
 * task list.
 */

import { Button } from "../Button";
import { labels } from "../../lib/labels";
import "./ChapterList.css";

export type ChapterRowData = {
  id: string;
  number: number;
  title: string;
  read: boolean;
  progress: number;
  completed: boolean;
};

export function ChapterList({
  chapters,
  sendingChapterId,
  onOpen,
  onSend,
}: {
  chapters: ChapterRowData[];
  sendingChapterId: string | null;
  onOpen: (id: string) => void;
  onSend: (id: string) => void;
}) {
  return (
    <ul className="ui-chapters">
      {chapters.map((chapter, index) => (
        // Rows arrive one after another, once, on first render (#161).
        <li key={chapter.id} className="ui-chapter" style={{ animationDelay: `${index * 40}ms` }}>
          <button className="ui-chapter-open" onClick={() => onOpen(chapter.id)}>
            <span className="ui-chapter-n">{chapter.number}</span>
            <span className="ui-chapter-title">{chapter.title}</span>
            <ChapterState chapter={chapter} />
          </button>

          <Button
            variant="quiet"
            onClick={() => onSend(chapter.id)}
            disabled={sendingChapterId !== null}
          >
            {sendingChapterId === chapter.id ? labels.home.sending : labels.home.send}
          </Button>
        </li>
      ))}
    </ul>
  );
}

/** Nothing until opened; then a ring that fills; then a check (D70). */
function ChapterState({ chapter }: { chapter: ChapterRowData }) {
  if (chapter.completed) {
    return (
      <span className="ui-chapter-done">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <circle cx="8" cy="8" r="7" fill="var(--accent)" />
          <path d="M4.8 8.2l2.2 2.1 4.2-4.4" fill="none" stroke="var(--on-accent)" strokeWidth="1.6"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="ui-chapter-done-label">{labels.home.completed}</span>
      </span>
    );
  }

  if (!chapter.read && chapter.progress === 0) return null;

  const percent = Math.round(chapter.progress * 100);
  const circumference = 2 * Math.PI * 6;

  return (
    <svg
      className="ui-chapter-ring"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      role="img"
      aria-label={`${percent}${labels.home.percentRead}`}
    >
      <circle cx="8" cy="8" r="6" fill="none" stroke="var(--rule)" strokeWidth="2" />
      <circle
        cx="8"
        cy="8"
        r="6"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - chapter.progress)}
        transform="rotate(-90 8 8)"
      />
    </svg>
  );
}
