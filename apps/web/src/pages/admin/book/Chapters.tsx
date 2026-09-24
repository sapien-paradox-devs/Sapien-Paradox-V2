/**
 * Chapters (D84): one list that can be renamed, reordered while a draft,
 * retried and deleted. Adding PDFs arrives in #183.
 */

import { useState } from "react";

import { Button } from "../../../components/Button";
import { labels } from "../../../lib/labels";
import type { AdminChapter, BookDetail } from "../types";
import type { Send } from "./shared";

export function Chapters({ book, busyChapterId, send }: {
  book: BookDetail;
  busyChapterId: string | null;
  send: Send;
}) {
  const l = labels.admin.book;

  return (
    <div className="admin-chapters">
      {book.isPublished && book.chapters.length > 1 && <p className="admin-note">{l.orderFixed}</p>}
      {book.chapters.length === 0 ? (
        <p className="admin-muted">{l.noChapters}</p>
      ) : (
        <ChapterList book={book} busyChapterId={busyChapterId} send={send} />
      )}
    </div>
  );
}

function ChapterList({ book, busyChapterId, send }: {
  book: BookDetail;
  busyChapterId: string | null;
  send: Send;
}) {
  const [dragging, setDragging] = useState<number | null>(null);
  const draggable = !book.isPublished && book.chapters.length > 1;

  const drop = (to: number) => {
    if (dragging === null || dragging === to) return;
    const ids = book.chapters.map((c) => c.id);
    const [moved] = ids.splice(dragging, 1);
    ids.splice(to, 0, moved);
    send({ type: "RUN", op: { kind: "reorder", chapterIds: ids } });
  };

  return (
    <ol className="admin-chapter-list">
      {book.chapters.map((chapter, index) => (
        <ChapterRow key={chapter.id} chapter={chapter} book={book} index={index}
          draggable={draggable} dragging={dragging === index}
          onDragStart={() => setDragging(index)} onDragEnd={() => setDragging(null)}
          onDrop={() => { drop(index); setDragging(null); }}
          busy={busyChapterId === chapter.id}
          send={send} />
      ))}
    </ol>
  );
}

function ChapterRow({ chapter, book, draggable, dragging, onDragStart, onDragEnd, onDrop, busy, send }: {
  chapter: AdminChapter;
  book: BookDetail;
  index: number;
  draggable: boolean;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDrop: () => void;
  busy: boolean;
  send: Send;
}) {
  const l = labels.admin.book;
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(chapter.title);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const canDelete = !book.isPublished && !chapter.hasReaders;

  return (
    <li className={`admin-chapter ${dragging ? "admin-dragging" : ""} ${busy ? "admin-busy" : ""}`}
      draggable={draggable} onDragStart={onDragStart} onDragEnd={onDragEnd}
      onDragOver={(e) => draggable && e.preventDefault()} onDrop={onDrop}>
      {draggable && <span className="admin-grip" title={l.dragToReorder} aria-hidden="true">⋮⋮</span>}
      <span className="admin-chapter-n">{chapter.number}</span>

      {renaming ? (
        <form className="admin-rename" onSubmit={(e) => {
          e.preventDefault();
          send({ type: "RUN", op: { kind: "rename", chapterId: chapter.id, title } });
          setRenaming(false);
        }}>
          <input className="admin-inline-input" value={title} autoFocus onChange={(e) => setTitle(e.target.value)} />
          <Button type="submit" variant="quiet">{l.saveTitle}</Button>
          <Button type="button" variant="text" onClick={() => { setTitle(chapter.title); setRenaming(false); }}>
            {l.cancel}
          </Button>
        </form>
      ) : (
        <span className="admin-chapter-title">
          {chapter.title}
          {chapter.hasVideo && <span className="admin-video-mark" title={l.hasVideo}>▶</span>}
        </span>
      )}

      {chapter.status === "ready" ? (
        <span className="admin-status admin-status-ready">{chapter.pageCount} {l.pages}</span>
      ) : (
        <span className="admin-status admin-status-failed">
          {l.statusFailed}
          <Button variant="text" onClick={() => send({ type: "RUN", op: { kind: "retryChapter", chapterId: chapter.id } })}>
            {l.retryRender}
          </Button>
        </span>
      )}

      {!renaming && (
        <span className="admin-row-actions">
          <Button variant="text" onClick={() => setRenaming(true)}>{l.rename}</Button>
          {canDelete && !confirmingDelete && (
            <Button variant="text" className="admin-danger-text" onClick={() => setConfirmingDelete(true)}>{l.delete}</Button>
          )}
          {chapter.hasReaders && <span className="admin-muted admin-small">{l.hasReaders}</span>}
        </span>
      )}

      {confirmingDelete && (
        <div className="admin-inline-confirm" role="alertdialog">
          <span>{l.deleteConfirm}</span>
          <Button className="admin-danger" onClick={() => {
            send({ type: "RUN", op: { kind: "deleteChapter", chapterId: chapter.id } });
            setConfirmingDelete(false);
          }}>{l.delete}</Button>
          <Button variant="text" onClick={() => setConfirmingDelete(false)}>{l.cancel}</Button>
        </div>
      )}
    </li>
  );
}
