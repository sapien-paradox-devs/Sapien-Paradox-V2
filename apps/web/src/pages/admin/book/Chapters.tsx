/**
 * Chapters (D84, D86): drop a folder or add PDFs, check the proposed list, then
 * one list of chapters that can be renamed, reordered while a draft, replaced,
 * retried and deleted.
 */

import { useState } from "react";

import { Button } from "../../../components/Button";
import { labels } from "../../../lib/labels";
import type { AdminChapter, BookDetail } from "../types";
import { DropZone, PickFile } from "./DropZone";
import type { StagedPdfs, UploadItem } from "./machine/types";
import { fill, percent, type Send } from "./shared";

export function Chapters({ book, staged, uploads, busyChapterId, send }: {
  book: BookDetail;
  staged: StagedPdfs | null;
  uploads: UploadItem[];
  busyChapterId: string | null;
  send: Send;
}) {
  const l = labels.admin.book;
  const pending = uploads.filter((u) => u.target.destination === "new_chapter" && u.status !== "done");

  return (
    <div className="admin-chapters">
      {staged ? (
        <StagedList staged={staged} send={send} />
      ) : (
        <DropZone title={l.dropPdfs} hint={l.dropPdfsHint} accept=".pdf,application/pdf"
          folderLabel={l.chooseFolder} filesLabel={l.addPdfs}
          onFiles={(files) => send({ type: "STAGE_PDFS", files })} />
      )}

      {book.isPublished && book.chapters.length > 1 && <p className="admin-note">{l.orderFixed}</p>}

      {book.chapters.length === 0 && pending.length === 0 ? (
        <p className="admin-muted">{l.noChapters}</p>
      ) : (
        <ChapterList book={book} uploads={uploads} busyChapterId={busyChapterId} send={send} />
      )}

      {pending.length > 0 && (
        <ol className="admin-chapter-list admin-chapter-pending" start={book.chapters.length + 1}>
          {pending.map((u) => (
            <li key={u.id} className="admin-chapter">
              <span className="admin-chapter-n">·</span>
              <span className="admin-chapter-title">{u.title || u.file.name}</span>
              <UploadStatus upload={u} pdf />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function StagedList({ staged, send }: { staged: StagedPdfs; send: Send }) {
  const l = labels.admin.book.staged;
  const [dragging, setDragging] = useState<number | null>(null);

  return (
    <div className="admin-staged">
      <h3>{l.title}</h3>
      <p className="admin-muted">{l.lead}</p>
      <ol className="admin-chapter-list">
        {staged.chapters.map((c, index) => (
          <li key={c.key} className={`admin-chapter ${dragging === index ? "admin-dragging" : ""}`}
            draggable onDragStart={() => setDragging(index)} onDragEnd={() => setDragging(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragging !== null) send({ type: "MOVE_STAGED", from: dragging, to: index });
              setDragging(null);
            }}>
            <span className="admin-grip" aria-hidden="true">⋮⋮</span>
            <span className="admin-chapter-n">{index + 1}</span>
            <input className="admin-inline-input" value={c.title} aria-label={labels.admin.book.rename}
              onChange={(e) => send({ type: "RETITLE_STAGED", key: c.key, title: e.target.value })} />
            <span className="admin-file-name">{c.file.name}</span>
            <Button variant="text" onClick={() => send({ type: "UNSTAGE", key: c.key })}>{l.remove}</Button>
          </li>
        ))}
      </ol>
      {staged.skipped.length > 0 && (
        <p className="admin-muted admin-skipped">{l.skipped} {staged.skipped.join(", ")}</p>
      )}
      <div className="admin-form-actions">
        <Button onClick={() => send({ type: "CONFIRM_PDFS" })}>{fill(l.confirm, staged.chapters.length)}</Button>
        <Button variant="text" onClick={() => send({ type: "CANCEL_PDFS" })}>{l.cancel}</Button>
      </div>
    </div>
  );
}

function ChapterList({ book, uploads, busyChapterId, send }: {
  book: BookDetail;
  uploads: UploadItem[];
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
          replacing={uploads.find((u) => u.target.destination === "chapter_pdf" && "chapterId" in u.target
            && u.target.chapterId === chapter.id && u.status !== "done")}
          send={send} />
      ))}
    </ol>
  );
}

function ChapterRow({ chapter, book, draggable, dragging, onDragStart, onDragEnd, onDrop, busy, replacing, send }: {
  chapter: AdminChapter;
  book: BookDetail;
  index: number;
  draggable: boolean;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDrop: () => void;
  busy: boolean;
  replacing: UploadItem | undefined;
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

      {replacing ? (
        <UploadStatus upload={replacing} pdf />
      ) : chapter.status === "ready" ? (
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
          <PickFile label={l.replacePdf} accept=".pdf,application/pdf"
            onFile={(file) => send({ type: "UPLOAD", file, target: { destination: "chapter_pdf", chapterId: chapter.id } })} />
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

export function UploadStatus({ upload, pdf }: { upload: UploadItem; pdf?: boolean }) {
  const l = labels.admin.book;
  if (upload.status === "failed") {
    return <span className="admin-status admin-status-failed">{upload.error ?? l.uploadFailed}</span>;
  }
  const text = upload.status === "queued" ? l.queued
    : upload.status === "finishing" ? (pdf ? l.finishing : l.finishingVideo)
    : upload.status === "done" ? l.uploaded
    : `${l.sending} ${percent(upload)}%`;
  return (
    <span className="admin-status admin-status-moving">
      <span className="admin-progress" aria-hidden="true"><span style={{ width: `${percent(upload)}%` }} /></span>
      {text}
    </span>
  );
}
