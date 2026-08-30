/**
 * The chapters a reader has earned, grouped by book. Renders props only — no
 * machine (D15): the home page owns loading/ready/empty/error; this only
 * knows how to lay out books once there's something to show.
 */

import { ChapterRow } from "./ChapterRow";
import type { Chapter } from "./ChapterRow";
import "./ChapterList.css";

export type { Chapter } from "./ChapterRow";

export type Book = {
  id: string;
  title: string;
  chapters: Chapter[];
};

export type ChapterListProps = {
  books: Book[];
  /** The chapter whose link is being sent, so one row can show its own state. */
  sendingChapterId: string | null;
  onOpen: (chapterId: string) => void;
  onSend: (chapterId: string) => void;
};

export function ChapterList({ books, sendingChapterId, onOpen, onSend }: ChapterListProps) {
  return (
    <div className="chapter-list">
      {books.map((book) => (
        <section key={book.id}>
          <h2>{book.title}</h2>
          <ul>
            {book.chapters.map((chapter) => (
              <ChapterRow
                key={chapter.id}
                chapter={chapter}
                sending={sendingChapterId === chapter.id}
                onOpen={() => onOpen(chapter.id)}
                onSend={() => onSend(chapter.id)}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
