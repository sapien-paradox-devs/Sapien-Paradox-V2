/**
 * The chapters of one book — the ones that have arrived, and the ones still to
 * come (#114).
 *
 * Progress is shown quietly (D70, reversing D11's "no progress bars"): a small
 * ring per chapter, and a check with "Completed" once the reader has marked it
 * so. No percentages on the rows, no badges, nothing that turns reading into a
 * task list.
 *
 * A locked chapter is a row, not an absence: the reader can see the shape of
 * their book. It is **not a button** — there is nothing to press, and a disabled
 * button invites a press and then refuses it — and it says the day it opens
 * rather than how long is left (D11).
 */

import { Button } from "../Button";
import { labels } from "../../lib/labels";
import { formatDayISO } from "../../lib/locale";
import "./ChapterList.css";

export type ChapterRowData = {
  id: string;
  number: number;
  title: string;
  read: boolean;
  progress: number;
  completed: boolean;
  locked: boolean;
  unlocksAt: string | null;
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
        <li
          key={chapter.id}
          className={chapter.locked ? "ui-chapter ui-chapter-is-locked" : "ui-chapter"}
          style={{ animationDelay: `${index * 40}ms` }}
        >
          {chapter.locked ? (
            <LockedRow chapter={chapter} />
          ) : (
            <>
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
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * A chapter the tick has not released yet: the title, and the day it opens.
 *
 * No link and no send button, because both would refuse (409). A seal rather
 * than a padlock — this is a book being posted to someone, not a paywall.
 */
function LockedRow({ chapter }: { chapter: ChapterRowData }) {
  const day = formatDayISO(chapter.unlocksAt);

  return (
    <div
      className="ui-chapter-locked"
      aria-label={day ? `${labels.home.lockedAria}${day}` : labels.home.locked}
    >
      <span className="ui-chapter-n">{chapter.number}</span>
      <span className="ui-chapter-title">{chapter.title}</span>
      <span className="ui-chapter-when">
        <Seal />
        {day ? `${labels.home.unlocks}${day}` : labels.home.locked}
      </span>
    </div>
  );
}

/** A wax seal, 12px. Saffron is the product's waiting colour (D81). */
function Seal() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <circle cx="8" cy="8" r="5.5" fill="var(--saffron-wash)" stroke="var(--saffron)" strokeWidth="1.2" />
      <circle cx="8" cy="8" r="1.8" fill="var(--saffron)" />
    </svg>
  );
}

/** Nothing until opened; then a ring that fills; then a check (D70). */
function ChapterState({ chapter }: { chapter: ChapterRowData }) {
  if (chapter.completed) {
    return (
      <span className="ui-chapter-done">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <circle cx="8" cy="8" r="7" fill="var(--teal)" />
          <path d="M4.8 8.2l2.2 2.1 4.2-4.4" fill="none" stroke="var(--on-bright)" strokeWidth="1.6"
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
        stroke="var(--saffron)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - chapter.progress)}
        transform="rotate(-90 8 8)"
      />
    </svg>
  );
}
