/**
 * The chapters of one book.
 *
 * The read mark is a quiet dot, not a progress bar (D11). This product is about
 * depth over velocity, and a completion meter turns reading into a task list.
 */

import { Button } from "../Button";
import { labels } from "../../lib/labels";
import "./ChapterList.css";

export type ChapterRowData = {
  id: string;
  number: number;
  title: string;
  read: boolean;
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
      {chapters.map((chapter) => (
        <li key={chapter.id} className="ui-chapter">
          <button className="ui-chapter-open" onClick={() => onOpen(chapter.id)}>
            <span className="ui-chapter-n">{chapter.number}</span>
            <span className="ui-chapter-title">{chapter.title}</span>
            {chapter.read && (
              <span className="ui-chapter-read" title={labels.home.read} aria-label={labels.home.read} />
            )}
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
