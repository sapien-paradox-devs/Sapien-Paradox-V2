/** Admin · Books (D82, D84): every book, drafts included, as covers. */

import { useMachine } from "@xstate/react";

import { Button } from "../../../components/Button";
import { ErrorNotice } from "../../../components/ErrorNotice";
import { Skeleton } from "../../../components/Skeleton";
import { labels } from "../../../lib/labels";
import { Cover } from "./Cover";
import { booksMachine } from "./machine";
import "./books.css";

export function BooksScreen({ navigate }: { navigate: (to: string) => void }) {
  const [state, send] = useMachine(booksMachine);
  const l = labels.admin.books;
  const books = state.context.books;

  return (
    <section>
      <header className="admin-screen-head">
        <h1>{l.title}</h1>
        <Button onClick={() => navigate("/admin/books/new")}>{l.add}</Button>
      </header>

      {state.matches("error") ? (
        <ErrorNotice action={labels.admin.readers.retry} onAction={() => send({ type: "RETRY" })}>
          {l.loadError}
        </ErrorNotice>
      ) : state.matches("loading") ? (
        <div className="admin-shelf">
          {[0, 1, 2].map((i) => <Skeleton key={i} ratio="2 / 3" />)}
        </div>
      ) : books.length === 0 ? (
        <p className="admin-empty">{l.empty}</p>
      ) : (
        <ul className="admin-shelf">
          {books.map((book) => (
            <li key={book.id}>
              <button type="button" className="admin-shelf-book"
                onClick={() => navigate(`/admin/books/${book.id}`)}>
                <Cover bookId={book.id} title={book.title} hasCover={book.hasCover} />
                <span className={`admin-pill ${book.isPublished ? "admin-pill-live" : ""}`}>
                  {book.isPublished ? l.published : l.draft}
                </span>
                <span className="admin-shelf-title">{book.title}</span>
                {book.author && <span className="admin-muted">{book.author}</span>}
                <span className="admin-shelf-meta">
                  {book.readyCount}/{book.chapterCount} {l.chapters} {l.ready} · {book.readerCount} {l.readers}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
