/** Admin · New book (D84): details first; the workspace opens next. */

import { useMachine } from "@xstate/react";
import { useEffect, useState } from "react";

import { Button } from "../../../components/Button";
import { ErrorNotice } from "../../../components/ErrorNotice";
import { TextField } from "../../../components/TextField";
import { labels } from "../../../lib/labels";
import { refusalText } from "../refusal";
import { newBookMachine } from "./machine";

export function NewBookScreen({ navigate }: { navigate: (to: string) => void }) {
  const [state, send] = useMachine(newBookMachine);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");
  const [rupees, setRupees] = useState("0");
  const { createdId, refusal } = state.context;
  const l = labels.admin.newBook;

  useEffect(() => {
    if (createdId) navigate(`/admin/books/${createdId}`);
  }, [createdId, navigate]);

  const edit = (set: (v: string) => void) => (value: string) => {
    set(value);
    send({ type: "EDIT" });
  };
  const saving = state.matches("saving");

  return (
    <section className="admin-form-screen">
      <header className="admin-screen-head"><h1>{l.title}</h1></header>
      <p className="admin-lead">{l.lead}</p>

      <form className="admin-form" onSubmit={(e) => {
        e.preventDefault();
        send({ type: "SUBMIT", book: {
          title, author, description, priceMinorUnits: Math.round(Number(rupees || 0) * 100),
        } });
      }}>
        <TextField label={l.bookTitle} id="b-title" value={title} autoFocus
          onChange={(e) => edit(setTitle)(e.target.value)} />
        {refusal?.field === "title" && <p className="admin-field-error">{refusalText(refusal.code)}</p>}
        <TextField label={l.author} id="b-author" value={author}
          onChange={(e) => edit(setAuthor)(e.target.value)} />
        <div className="ui-field">
          <label htmlFor="b-description">{l.description}</label>
          <textarea id="b-description" className="admin-textarea" rows={4} value={description}
            onChange={(e) => edit(setDescription)(e.target.value)} />
        </div>
        <TextField label={l.price} id="b-price" type="number" min="0" step="1" hint={l.priceHint}
          value={rupees} onChange={(e) => edit(setRupees)(e.target.value)} />
        {refusal?.field === "priceMinorUnits" && (
          <p className="admin-field-error">{refusalText(refusal.code)}</p>
        )}
        {refusal && !refusal.field && <ErrorNotice>{refusalText(refusal.code)}</ErrorNotice>}

        <div className="admin-form-actions">
          <Button type="submit" disabled={saving}>{saving ? l.saving : l.submit}</Button>
          <Button type="button" variant="text" onClick={() => navigate("/admin/books")}>{l.cancel}</Button>
        </div>
      </form>
    </section>
  );
}
