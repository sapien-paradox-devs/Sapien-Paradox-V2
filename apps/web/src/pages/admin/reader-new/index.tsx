/** Admin · Add a reader (D82). A reader always starts with a book (D26). */

import { useMachine } from "@xstate/react";
import { useEffect, useState } from "react";

import { Button } from "../../../components/Button";
import { ErrorNotice } from "../../../components/ErrorNotice";
import { TextField } from "../../../components/TextField";
import { PACE } from "../../../lib/constants";
import { labels } from "../../../lib/labels";
import { refusalText } from "../refusal";
import { newReaderMachine, type NewReader } from "./machine";

const EMPTY: NewReader = { fullName: "", email: "", phone: "", bookSlug: "", pace: "medium" };

export function NewReaderScreen({
  navigate,
  onCreated,
}: {
  navigate: (to: string) => void;
  /** Tells the shell how it went, so the reader's page can say so. */
  onCreated: (id: string, delivered: boolean) => void;
}) {
  const [state, send] = useMachine(newReaderMachine);
  const [reader, setReader] = useState<NewReader>(EMPTY);
  const { books, refusal, created, delivered } = state.context;
  const l = labels.admin.form;

  useEffect(() => {
    if (created) onCreated(created.id, delivered);
  }, [created, delivered, onCreated]);

  // Default to the first book once they arrive, so the common case is one fewer choice.
  useEffect(() => {
    if (books.length > 0) setReader((r) => (r.bookSlug ? r : { ...r, bookSlug: books[0].slug }));
  }, [books]);

  const set = (field: keyof NewReader) => (value: string) => {
    setReader((r) => ({ ...r, [field]: value }));
    send({ type: "EDIT" });
  };
  const fieldError = (field: string) =>
    refusal && refusal.field === field ? refusalText(refusal.code) : undefined;
  const saving = state.matches("saving");

  if (state.matches("booksFailed")) {
    return (
      <ErrorNotice action={labels.admin.readers.retry} onAction={() => send({ type: "RETRY" })}>
        {labels.admin.readers.loadError}
      </ErrorNotice>
    );
  }

  return (
    <section className="admin-form-screen">
      <header className="admin-screen-head">
        <h1>{l.newTitle}</h1>
      </header>
      <p className="admin-lead">{l.newLead}</p>

      <form
        className="admin-form"
        onSubmit={(e) => {
          e.preventDefault();
          send({ type: "SUBMIT", reader });
        }}
      >
        <TextField label={l.fullName} id="r-name" autoComplete="off" value={reader.fullName}
          onChange={(e) => set("fullName")(e.target.value)} />
        <FieldError text={fieldError("fullName")} />

        <TextField label={l.email} id="r-email" type="email" autoComplete="off"
          value={reader.email} onChange={(e) => set("email")(e.target.value)} />
        <FieldError text={fieldError("email")} />

        <TextField label={l.phone} id="r-phone" type="tel" autoComplete="off" hint={l.phoneHint}
          value={reader.phone} onChange={(e) => set("phone")(e.target.value)} />
        <FieldError text={fieldError("phone")} />

        <div className="ui-field">
          <label htmlFor="r-book">{l.book}</label>
          <select id="r-book" className="admin-select" value={reader.bookSlug}
            disabled={state.matches("loadingBooks")}
            onChange={(e) => set("bookSlug")(e.target.value)}>
            {state.matches("loadingBooks") && <option value="">{l.bookLoading}</option>}
            {books.map((book) => (
              <option key={book.slug} value={book.slug}>{book.title}</option>
            ))}
          </select>
        </div>
        <FieldError text={fieldError("bookSlug")} />

        <div className="ui-field">
          <label htmlFor="r-pace">{l.pace}</label>
          <select id="r-pace" className="admin-select" value={reader.pace}
            onChange={(e) => set("pace")(e.target.value)}>
            {PACE.map((key) => (
              <option key={key} value={key}>{labels.pace[key]}</option>
            ))}
          </select>
        </div>

        {refusal && !refusal.field && <ErrorNotice>{refusalText(refusal.code)}</ErrorNotice>}
        {state.matches("failed") && <ErrorNotice>{l.error}</ErrorNotice>}

        <div className="admin-form-actions">
          <Button type="submit" disabled={saving}>{saving ? l.saving : l.submit}</Button>
          <Button type="button" variant="text" onClick={() => navigate("/admin/readers")}>
            {l.cancel}
          </Button>
        </div>
      </form>
    </section>
  );
}

function FieldError({ text }: { text?: string }) {
  return text ? <p className="admin-field-error" role="alert">{text}</p> : null;
}
