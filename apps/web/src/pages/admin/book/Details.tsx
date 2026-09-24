/** Details and the cover (D84). Editing saves in one request. Uploading a cover arrives in #183. */

import { useState } from "react";

import { Button } from "../../../components/Button";
import { TextField } from "../../../components/TextField";
import { labels } from "../../../lib/labels";
import { Cover } from "../books/Cover";
import { refusalText } from "../refusal";
import type { BookDetail, Refusal } from "../types";
import type { Send } from "./shared";

export function Details({ book, refusal, saving, send }: {
  book: BookDetail;
  refusal: Refusal | null;
  saving: boolean;
  send: Send;
}) {
  const l = labels.admin.book;
  const n = labels.admin.newBook;
  const [title, setTitle] = useState(book.title);
  const [author, setAuthor] = useState(book.author);
  const [description, setDescription] = useState(book.description);
  const [rupees, setRupees] = useState(String(book.priceMinorUnits / 100));

  const fieldError = (field: string) =>
    refusal?.field === field ? <p className="admin-field-error">{refusalText(refusal.code)}</p> : null;

  return (
    <div className="admin-details">
      <form className="admin-form" onSubmit={(e) => {
        e.preventDefault();
        send({ type: "RUN", op: { kind: "details", details: {
          title, author, description, priceMinorUnits: Math.round(Number(rupees || 0) * 100),
        } } });
      }}>
        <TextField label={n.bookTitle} id="d-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        {fieldError("title")}
        <TextField label={n.author} id="d-author" value={author} onChange={(e) => setAuthor(e.target.value)} />
        <div className="ui-field">
          <label htmlFor="d-description">{n.description}</label>
          <textarea id="d-description" className="admin-textarea" rows={4} value={description}
            onChange={(e) => setDescription(e.target.value)} />
        </div>
        <TextField label={n.price} id="d-price" type="number" min="0" step="1" value={rupees}
          onChange={(e) => setRupees(e.target.value)} />
        {fieldError("priceMinorUnits")}
        <div className="admin-form-actions">
          <Button type="submit" disabled={saving}>{saving ? l.saving : l.save}</Button>
        </div>
      </form>

      <div className="admin-cover-slot">
        <p className="admin-slot-label">{l.cover}</p>
        <Cover bookId={book.id} title={book.title} hasCover={book.hasCover} />
        <div className="admin-form-actions">
          {book.hasCover && !book.isPublished && (
            <Button variant="text" onClick={() => send({ type: "RUN", op: { kind: "removeMedia", which: "cover" } })}>
              {l.remove}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
