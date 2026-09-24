/**
 * Admin · The book workspace (D84). One screen per book: Details, Chapters,
 * Publish (videos arrive in #184). Every upload saves as it lands, and every change returns
 * the book, so this always draws the server's truth.
 */

import { useMachine } from "@xstate/react";
import { useState } from "react";

import { ErrorNotice } from "../../../components/ErrorNotice";
import { Skeleton } from "../../../components/Skeleton";
import { labels } from "../../../lib/labels";
import { refusalText } from "../refusal";
import { Chapters } from "./Chapters";
import { Details } from "./Details";
import { bookMachine } from "./machine";
import { Publish } from "./Publish";
import { Uploads } from "./Uploads";
import "./book.css";

type Section = "details" | "chapters" | "publish";
const SECTIONS: Section[] = ["details", "chapters", "publish"];

export function BookWorkspace({ id, navigate }: { id: string; navigate: (to: string) => void }) {
  const [state, send] = useMachine(bookMachine, { input: { id } });
  const { book, refusal, op, stagedPdfs, uploads } = state.context;
  const l = labels.admin.book;
  // Opens on Chapters: after creating a book, adding its PDFs is the next job.
  const [section, setSection] = useState<Section>("chapters");

  const back = (
    <button type="button" className="admin-back linklike" onClick={() => navigate("/admin/books")}>
      ← {l.back}
    </button>
  );

  if (state.matches({ data: "error" })) {
    return (
      <section>
        {back}
        <ErrorNotice action={labels.admin.readers.retry} onAction={() => send({ type: "RETRY" })}>
          {l.loadError}
        </ErrorNotice>
      </section>
    );
  }

  if (!book) {
    return (
      <section className="admin-reader">
        {back}
        <Skeleton height="2.4rem" width="50%" />
        <Skeleton height="14rem" />
      </section>
    );
  }

  const working = state.matches({ ops: "working" });
  const counts: Record<Section, string> = {
    details: "",
    chapters: String(book.chapters.length),
    publish: book.isPublished ? labels.admin.books.published : book.checklist.passes ? "✓" : "",
  };
  const busyChapterId = working && op && "chapterId" in op ? op.chapterId : null;
  const coverUpload = [...uploads].reverse().find((u) => u.target.destination === "book_cover");
  const coverVersion = uploads.filter((u) => u.target.destination === "book_cover" && u.status === "done").length;

  return (
    <section className="admin-workspace">
      {back}
      <header className="admin-screen-head">
        <div>
          <h1>{book.title}</h1>
          {book.author && <p className="admin-muted">{book.author}</p>}
        </div>
        <span className={`admin-pill-inline ${book.isPublished ? "admin-pill-live" : ""}`}>
          {book.isPublished ? labels.admin.books.published : labels.admin.books.draft}
        </span>
      </header>

      <nav className="admin-tabs" role="tablist">
        {SECTIONS.map((name) => (
          <button key={name} type="button" role="tab" aria-selected={section === name}
            className="admin-tab" onClick={() => setSection(name)}>
            {l.sections[name]}
            {counts[name] && <span className="admin-tab-count">{counts[name]}</span>}
          </button>
        ))}
      </nav>

      {/* Outside the tab panel, so a long batch can be watched from any tab (D85). */}
      <Uploads uploads={uploads} send={send} />

      {refusal && (
        <ErrorNotice action={labels.admin.reader.cancel} onAction={() => send({ type: "DISMISS_REFUSAL" })}>
          {refusalText(refusal.code)}
        </ErrorNotice>
      )}

      <div className="admin-section" role="tabpanel">
        {section === "details" && (
          <Details key={book.id} book={book} refusal={refusal} coverUpload={coverUpload} coverVersion={coverVersion}
            saving={working && op?.kind === "details"} send={send} />
        )}
        {section === "chapters" && (
          <Chapters book={book} staged={stagedPdfs} uploads={uploads} busyChapterId={busyChapterId} send={send} />
        )}
        {section === "publish" && <Publish book={book} working={working} send={send} />}
      </div>
    </section>
  );
}
