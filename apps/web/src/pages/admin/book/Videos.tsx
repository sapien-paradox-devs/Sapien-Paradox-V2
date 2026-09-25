/**
 * Videos (D83, D86): the book video, the public sample, and one per chapter.
 * A dropped batch is matched first and shown as a board: slots and a tray,
 * with videos dragged between them. Nothing uploads until it is confirmed.
 */

import { useState } from "react";

import { Button } from "../../../components/Button";
import { labels } from "../../../lib/labels";
import type { BookDetail } from "../types";
import { UploadStatus } from "./Chapters";
import { DropZone, PickFile } from "./DropZone";
import type { Slot, StagedVideo, StagedVideos, Target, UploadItem } from "./machine/types";
import { fill, megabytes, type Send } from "./shared";

type SlotRow = { slot: Slot; label: string; hint?: string; has: boolean; target: Target;
  remove: () => void };

export function Videos({ book, staged, uploads, send }: {
  book: BookDetail;
  staged: StagedVideos | null;
  uploads: UploadItem[];
  send: Send;
}) {
  const l = labels.admin.book;

  const rows: SlotRow[] = [
    { slot: { kind: "book_video" }, label: l.bookVideo, hint: l.bookVideoHint, has: book.hasVideo,
      target: { destination: "book_video" },
      remove: () => send({ type: "RUN", op: { kind: "removeMedia", which: "video" } }) },
    { slot: { kind: "book_sample" }, label: l.sample, hint: l.sampleHint, has: book.hasSample,
      target: { destination: "book_sample" },
      remove: () => send({ type: "RUN", op: { kind: "removeMedia", which: "sample" } }) },
    ...book.chapters.map((c): SlotRow => ({
      slot: { kind: "chapter", chapterId: c.id },
      label: `${fill(l.chapterVideo, c.number)} · ${c.title}`,
      has: c.hasVideo,
      target: { destination: "chapter_video", chapterId: c.id },
      remove: () => send({ type: "RUN", op: { kind: "removeChapterVideo", chapterId: c.id } }),
    })),
  ];

  if (staged) return <Board rows={rows} staged={staged} send={send} />;

  return (
    <div className="admin-videos">
      <DropZone title={l.dropVideos} hint={l.dropVideosHint} accept=".mp4,video/mp4"
        folderLabel={l.chooseFolder} filesLabel={l.chooseVideos}
        onFiles={(files) => send({ type: "STAGE_VIDEOS", files })} />

      <ul className="admin-slots">
        {rows.map((row) => {
          const upload = uploads.find((u) => sameTarget(u.target, row.target) && u.status !== "done");
          return (
            <li key={key(row.slot)} className="admin-slot">
              <div className="admin-slot-text">
                <span className="admin-slot-name">{row.label}</span>
                {row.hint && <span className="admin-muted admin-small">{row.hint}</span>}
              </div>
              {upload ? (
                <UploadStatus upload={upload} />
              ) : (
                <span className={`admin-status ${row.has ? "admin-status-ready" : ""}`}>
                  {row.has ? l.hasVideo : l.noVideo}
                </span>
              )}
              <span className="admin-row-actions">
                <PickFile label={row.has ? l.replace : l.addVideo} accept=".mp4,video/mp4"
                  onFile={(file) => send({ type: "UPLOAD", file, target: row.target })} />
                {row.has && <Button variant="text" onClick={row.remove}>{l.remove}</Button>}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Board({ rows, staged, send }: { rows: SlotRow[]; staged: StagedVideos; send: Send }) {
  const l = labels.admin.book.stagedVideos;
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const inSlot = (slot: Slot) => staged.videos.filter((v) => key(v.slot) === key(slot));
  const tray = inSlot({ kind: "tray" });
  const count = staged.videos.filter((v) => v.slot.kind !== "tray").length;

  const target = (slot: Slot) => ({
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setOver(key(slot)); },
    onDragLeave: () => setOver(null),
    onDrop: () => {
      if (dragging) send({ type: "ASSIGN_VIDEO", key: dragging, slot });
      setDragging(null);
      setOver(null);
    },
  });

  const chip = (video: StagedVideo) => (
    <span key={video.key} className="admin-chip" draggable
      onDragStart={() => setDragging(video.key)} onDragEnd={() => setDragging(null)}>
      ▶ {video.file.name} <span className="admin-muted">{megabytes(video.file.size)}</span>
    </span>
  );

  return (
    <div className="admin-staged">
      <h3>{l.title}</h3>
      <p className="admin-muted">{l.lead}</p>

      <ul className="admin-slots">
        {rows.map((row) => (
          <li key={key(row.slot)} {...target(row.slot)}
            className={`admin-slot admin-slot-target ${over === key(row.slot) ? "admin-slot-over" : ""}`}>
            <span className="admin-slot-name">{row.label}</span>
            <span className="admin-slot-drop">
              {inSlot(row.slot).map(chip)}
              {inSlot(row.slot).length === 0 && <span className="admin-muted admin-small">{l.dropHere}</span>}
            </span>
          </li>
        ))}
      </ul>

      <div {...target({ kind: "tray" })} className={`admin-tray ${over === "tray" ? "admin-slot-over" : ""}`}>
        <p className="admin-slot-label">{l.tray}</p>
        {tray.length ? tray.map(chip) : <span className="admin-muted admin-small">{l.trayEmpty}</span>}
      </div>

      {staged.skipped.length > 0 && (
        <p className="admin-muted admin-skipped">{labels.admin.book.staged.skipped} {staged.skipped.join(", ")}</p>
      )}
      <div className="admin-form-actions">
        <Button disabled={count === 0} onClick={() => send({ type: "CONFIRM_VIDEOS" })}>{fill(l.confirm, count)}</Button>
        <Button variant="text" onClick={() => send({ type: "CANCEL_VIDEOS" })}>{l.cancel}</Button>
      </div>
    </div>
  );
}

function key(slot: Slot): string {
  return slot.kind === "chapter" ? `chapter:${slot.chapterId}` : slot.kind;
}

function sameTarget(a: Target, b: Target): boolean {
  if (a.destination !== b.destination) return false;
  return !("chapterId" in a) || ("chapterId" in b && a.chapterId === b.chapterId);
}
