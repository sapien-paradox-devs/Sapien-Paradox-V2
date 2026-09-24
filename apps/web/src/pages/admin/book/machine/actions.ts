import type { AnyEventObject } from "xstate";

import { refusalOf } from "../../refusal";
import type { BookDetail } from "../../types";
import { planChapters, planVideos } from "../../books/match";
import type { Context, Event, StagedVideo, Target, UploadItem } from "./types";

const PDF_LANE = new Set(["new_chapter", "chapter_pdf"]);
const OTHER_CONCURRENCY = 2;

// ── the book ──────────────────────────────────────────────────────────────────

export function bookFrom({ event }: { event: AnyEventObject }): Partial<Context> {
  const output = "output" in event ? event.output : null;
  return isBook(output) ? { book: output } : {};
}

export function bookFromUpload({ event }: { event: Event }): Partial<Context> {
  return event.type === "UPLOAD_DONE" ? { book: event.book } : {};
}

export function opFrom({ event }: { event: Event }): Pick<Context, "op"> {
  return { op: event.type === "RUN" ? event.op : null };
}

export function clearOp(): Pick<Context, "op"> {
  return { op: null };
}

export function opRefusal({ event }: { event: AnyEventObject }): Pick<Context, "refusal"> {
  return { refusal: refusalOf(event) ?? { code: "failed", field: null } };
}

export function clearRefusal(): Pick<Context, "refusal"> {
  return { refusal: null };
}

function isBook(value: unknown): value is BookDetail {
  return typeof value === "object" && value !== null && "chapters" in value && "checklist" in value;
}

// ── staging a folder of PDFs (D86) ────────────────────────────────────────────

export function stagePdfs({ event }: { event: Event }): Pick<Context, "stagedPdfs"> {
  if (event.type !== "STAGE_PDFS") return { stagedPdfs: null };
  const plan = planChapters(event.files.map((file) => ({ name: pathOf(file), file })));
  return {
    stagedPdfs: {
      chapters: plan.chapters.map((c, i) => ({ key: `${i}:${c.file.name}`, file: c.file.file, title: c.title })),
      skipped: plan.skipped.map((f) => f.name),
    },
  };
}

export function retitleStaged({ context, event }: { context: Context; event: Event }): Pick<Context, "stagedPdfs"> {
  const staged = context.stagedPdfs;
  if (!staged || event.type !== "RETITLE_STAGED") return { stagedPdfs: staged };
  return {
    stagedPdfs: {
      ...staged,
      chapters: staged.chapters.map((c) => (c.key === event.key ? { ...c, title: event.title } : c)),
    },
  };
}

export function moveStaged({ context, event }: { context: Context; event: Event }): Pick<Context, "stagedPdfs"> {
  const staged = context.stagedPdfs;
  if (!staged || event.type !== "MOVE_STAGED") return { stagedPdfs: staged };
  return { stagedPdfs: { ...staged, chapters: move(staged.chapters, event.from, event.to) } };
}

export function unstage({ context, event }: { context: Context; event: Event }): Pick<Context, "stagedPdfs"> {
  const staged = context.stagedPdfs;
  if (!staged || event.type !== "UNSTAGE") return { stagedPdfs: staged };
  const chapters = staged.chapters.filter((c) => c.key !== event.key);
  return { stagedPdfs: chapters.length ? { ...staged, chapters } : null };
}

export function enqueueStagedPdfs({ context }: { context: Context }): Partial<Context> {
  const staged = context.stagedPdfs;
  if (!staged) return {};
  let next = context.nextUploadId;
  const items: UploadItem[] = staged.chapters.map((c) =>
    item(`u${next++}`, c.file, { destination: "new_chapter" }, c.title.trim()));
  return { stagedPdfs: null, uploads: [...context.uploads, ...items], nextUploadId: next };
}

export function cancelPdfs(): Pick<Context, "stagedPdfs"> {
  return { stagedPdfs: null };
}

// ── staging a batch of videos (D86) ───────────────────────────────────────────

export function stageVideos({ context, event }: { context: Context; event: Event }): Pick<Context, "stagedVideos"> {
  if (event.type !== "STAGE_VIDEOS" || !context.book) return { stagedVideos: null };
  const chapters = context.book.chapters.map((c) => ({ id: c.id, number: c.number, title: c.title }));
  const named = event.files.map((file) => ({ name: pathOf(file), file }));
  const plan = planVideos(named, chapters);
  let n = 0;
  const videos: StagedVideo[] = [
    ...plan.matches.map((m) => ({ key: `${n++}`, file: m.file.file, slot: { kind: "chapter" as const, chapterId: m.chapterId } })),
    ...(plan.sample ? [{ key: `${n++}`, file: plan.sample.file, slot: { kind: "book_sample" as const } }] : []),
    ...plan.tray.map((f) => ({ key: `${n++}`, file: f.file, slot: { kind: "tray" as const } })),
  ];
  return { stagedVideos: { videos, skipped: plan.skipped.map((f) => f.name) } };
}

/**
 * Moving a staged video into a slot. A slot holds one video: whatever was there
 * goes back to the tray, so a drag never silently drops a file.
 */
export function assignVideo({ context, event }: { context: Context; event: Event }): Pick<Context, "stagedVideos"> {
  const staged = context.stagedVideos;
  if (!staged || event.type !== "ASSIGN_VIDEO") return { stagedVideos: staged };
  const target = event.slot;
  const same = (a: StagedVideo["slot"]) =>
    target.kind !== "tray" && a.kind === target.kind &&
    (a.kind !== "chapter" || (target.kind === "chapter" && a.chapterId === target.chapterId));
  return {
    stagedVideos: {
      ...staged,
      videos: staged.videos.map((v) => {
        if (v.key === event.key) return { ...v, slot: target };
        if (same(v.slot)) return { ...v, slot: { kind: "tray" } };
        return v;
      }),
    },
  };
}

export function enqueueStagedVideos({ context }: { context: Context }): Partial<Context> {
  const staged = context.stagedVideos;
  if (!staged) return {};
  let next = context.nextUploadId;
  const items: UploadItem[] = [];
  for (const video of staged.videos) {
    const target = targetOf(video.slot);
    if (target) items.push(item(`u${next++}`, video.file, target, ""));
  }
  return { stagedVideos: null, uploads: [...context.uploads, ...items], nextUploadId: next };
}

export function cancelVideos(): Pick<Context, "stagedVideos"> {
  return { stagedVideos: null };
}

function targetOf(slot: StagedVideo["slot"]): Target | null {
  if (slot.kind === "chapter") return { destination: "chapter_video", chapterId: slot.chapterId };
  if (slot.kind === "book_video") return { destination: "book_video" };
  if (slot.kind === "book_sample") return { destination: "book_sample" };
  return null; // still in the tray: not uploaded
}

// ── the queue (D85) ───────────────────────────────────────────────────────────

export function enqueueOne({ context, event }: { context: Context; event: Event }): Partial<Context> {
  if (event.type !== "UPLOAD") return {};
  const id = `u${context.nextUploadId}`;
  return {
    uploads: [...context.uploads, item(id, event.file, event.target, titleFor(event.file))],
    nextUploadId: context.nextUploadId + 1,
  };
}

export function requeue({ context, event }: { context: Context; event: Event }): Pick<Context, "uploads"> {
  if (event.type !== "RETRY_UPLOAD") return { uploads: context.uploads };
  return { uploads: patch(context.uploads, event.id, { status: "queued", loaded: 0, error: null }) };
}

export function clearFinished({ context }: { context: Context }): Pick<Context, "uploads"> {
  return { uploads: context.uploads.filter((u) => u.status !== "done") };
}

export function progress({ context, event }: { context: Context; event: Event }): Pick<Context, "uploads"> {
  if (event.type !== "UPLOAD_PROGRESS") return { uploads: context.uploads };
  return { uploads: patch(context.uploads, event.id, { loaded: event.loaded }) };
}

export function finishing({ context, event }: { context: Context; event: Event }): Pick<Context, "uploads"> {
  if (event.type !== "UPLOAD_FINISHING") return { uploads: context.uploads };
  return { uploads: patch(context.uploads, event.id, { status: "finishing", loaded: sizeOf(context, event.id) }) };
}

export function done({ context, event }: { context: Context; event: Event }): Pick<Context, "uploads"> {
  if (event.type !== "UPLOAD_DONE") return { uploads: context.uploads };
  return { uploads: patch(context.uploads, event.id, { status: "done" }) };
}

export function failed({ context, event }: { context: Context; event: Event }): Pick<Context, "uploads"> {
  if (event.type !== "UPLOAD_FAILED") return { uploads: context.uploads };
  return { uploads: patch(context.uploads, event.id, { status: "failed", error: event.message }) };
}

/**
 * Which queued items may start now. PDFs one at a time and in order, so
 * chapters land in the confirmed sequence; everything else two at a time.
 */
export function startable(uploads: UploadItem[]): UploadItem[] {
  const moving = uploads.filter((u) => u.status === "sending" || u.status === "finishing");
  const pdfBusy = moving.some((u) => PDF_LANE.has(u.target.destination));
  let otherSlots = OTHER_CONCURRENCY - moving.filter((u) => !PDF_LANE.has(u.target.destination)).length;

  const start: UploadItem[] = [];
  const firstPdf = uploads.find((u) => u.status === "queued" && PDF_LANE.has(u.target.destination));
  if (!pdfBusy && firstPdf) start.push(firstPdf);
  for (const u of uploads) {
    if (u.status === "queued" && !PDF_LANE.has(u.target.destination) && otherSlots > 0) {
      start.push(u);
      otherSlots--;
    }
  }
  return start;
}

export function markSending(uploads: UploadItem[], ids: Set<string>): UploadItem[] {
  return uploads.map((u) => (ids.has(u.id) ? { ...u, status: "sending", loaded: 0, error: null } : u));
}

function item(id: string, file: File, target: Target, title: string): UploadItem {
  return { id, file, target, title, status: "queued", loaded: 0, error: null };
}

function patch(uploads: UploadItem[], id: string, change: Partial<UploadItem>): UploadItem[] {
  return uploads.map((u) => (u.id === id ? { ...u, ...change } : u));
}

function sizeOf(context: Context, id: string): number {
  return context.uploads.find((u) => u.id === id)?.file.size ?? 0;
}

function move<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const copy = [...list];
  const [moved] = copy.splice(from, 1);
  copy.splice(to, 0, moved);
  return copy;
}

/** A dropped folder keeps each file's path; a picked file has only its name. */
function pathOf(file: File): string {
  return file.webkitRelativePath || file.name;
}

function titleFor(file: File): string {
  return planChapters([{ name: file.name }]).chapters[0]?.title ?? file.name;
}
