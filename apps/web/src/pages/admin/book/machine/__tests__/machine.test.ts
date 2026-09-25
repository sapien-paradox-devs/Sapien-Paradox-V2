import { describe, expect, it } from "vitest";
import { createActor, fromCallback, fromPromise } from "xstate";

import type { BookDetail } from "../../../types";
import type { UploadInput } from "../actors";
import { startable } from "../actions";
import type { Event, Op, UploadItem } from "../types";
import { bookMachine } from "..";

const BOOK: BookDetail = {
  id: "1", slug: "b", title: "Book", author: "", isPublished: false, chapterCount: 2, readyCount: 2,
  hasCover: false, readerCount: 0, createdAt: "", description: "", priceMinorUnits: 0,
  hasVideo: false, hasSample: false,
  chapters: [
    { id: "10", number: 1, title: "Descent", status: "ready", pageCount: 3, hasVideo: false, hasReaders: false },
    { id: "11", number: 2, title: "Clocks", status: "ready", pageCount: 3, hasVideo: false, hasReaders: false },
  ],
  checklist: { hasChapters: true, allReady: true, hasCover: false, passes: false },
};

const file = (name: string, size = 10) => new File([new Uint8Array(size)], name);

/** Upload children that do nothing until the test says, so ordering can be observed. */
function start() {
  const started: UploadInput[] = [];
  const machine = bookMachine.provide({
    actors: {
      fetchBook: fromPromise<BookDetail, { id: string }>(async () => BOOK),
      runOp: fromPromise<BookDetail, { id: string; op: Op | null }>(async () => BOOK),
      uploadFile: fromCallback<Event, UploadInput>(({ input }) => {
        started.push(input);
      }),
    },
  });
  const actor = createActor(machine, { input: { id: "1" } }).start();
  const finish = (id: string) =>
    actor.send({ type: "UPLOAD_DONE", id, book: { ...BOOK, chapterCount: 3 } });
  return { actor, started, finish };
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe("staging a folder (D86)", () => {
  it("proposes chapters in filename order, uploads nothing until confirmed", async () => {
    const { actor, started } = start();
    await settle();
    actor.send({ type: "STAGE_PDFS", files: [file("2 Two.pdf"), file("1 One.pdf"), file("notes.txt")] });

    const staged = actor.getSnapshot().context.stagedPdfs;
    expect(staged?.chapters.map((c) => c.title)).toEqual(["One", "Two"]);
    expect(staged?.skipped).toEqual(["notes.txt"]);
    expect(started).toEqual([]);
  });

  it("carries edited titles and order into the uploads", async () => {
    const { actor } = start();
    await settle();
    actor.send({ type: "STAGE_PDFS", files: [file("1 One.pdf"), file("2 Two.pdf")] });
    const [first] = actor.getSnapshot().context.stagedPdfs?.chapters ?? [];
    actor.send({ type: "RETITLE_STAGED", key: first.key, title: "Beginning" });
    actor.send({ type: "MOVE_STAGED", from: 0, to: 1 });
    actor.send({ type: "CONFIRM_PDFS" });

    const uploads = actor.getSnapshot().context.uploads;
    expect(uploads.map((u) => u.title)).toEqual(["Two", "Beginning"]);
    expect(actor.getSnapshot().context.stagedPdfs).toBeNull();
  });
});

describe("the upload queue (D85)", () => {
  it("sends PDFs one at a time, in order, so chapters land in sequence", async () => {
    const { actor, started, finish } = start();
    await settle();
    actor.send({ type: "STAGE_PDFS", files: [file("1 a.pdf"), file("2 b.pdf"), file("3 c.pdf")] });
    actor.send({ type: "CONFIRM_PDFS" });
    expect(started.map((s) => s.title)).toEqual(["A"]);

    finish(started[0].id);
    expect(started.map((s) => s.title)).toEqual(["A", "B"]);
    finish(started[1].id);
    expect(started.map((s) => s.title)).toEqual(["A", "B", "C"]);
  });

  it("sends videos alongside, two at a time", async () => {
    const { actor, started } = start();
    await settle();
    for (const name of ["x.mp4", "y.mp4", "z.mp4"]) {
      actor.send({ type: "UPLOAD", file: file(name), target: { destination: "book_video" } });
    }
    expect(started).toHaveLength(2);
  });

  it("takes the book from a finished upload", async () => {
    const { actor, started, finish } = start();
    await settle();
    actor.send({ type: "UPLOAD", file: file("c.png"), target: { destination: "book_cover" } });
    finish(started[0].id);
    expect(actor.getSnapshot().context.book?.chapterCount).toBe(3);
    expect(actor.getSnapshot().context.uploads[0].status).toBe("done");
  });

  it("a failure keeps the file and can be retried", async () => {
    const { actor, started } = start();
    await settle();
    actor.send({ type: "UPLOAD", file: file("a.pdf"), target: { destination: "new_chapter" } });
    actor.send({ type: "UPLOAD_FAILED", id: started[0].id, message: "nope" });
    expect(actor.getSnapshot().context.uploads[0]).toMatchObject({ status: "failed", error: "nope" });

    actor.send({ type: "RETRY_UPLOAD", id: started[0].id });
    expect(started).toHaveLength(2);
    expect(actor.getSnapshot().context.uploads[0].status).toBe("sending");
  });
});

describe("startable", () => {
  const u = (id: string, destination: UploadItem["target"]["destination"], status: UploadItem["status"]) =>
    ({ id, file: file(id), target: { destination } as UploadItem["target"], title: "", status, loaded: 0, error: null });

  it("never starts a second PDF while one is moving", () => {
    const list = [u("a", "new_chapter", "finishing"), u("b", "new_chapter", "queued"), u("c", "book_video", "queued")];
    expect(startable(list).map((x) => x.id)).toEqual(["c"]);
  });
});
