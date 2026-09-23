/** Admin · One reader (D82): their details, their books, and what can be done (D80). */

import { useMachine } from "@xstate/react";
import { useState } from "react";

import { Button } from "../../../components/Button";
import { ErrorNotice } from "../../../components/ErrorNotice";
import { Skeleton } from "../../../components/Skeleton";
import { TextField } from "../../../components/TextField";
import { labels } from "../../../lib/labels";
import { formatDate } from "../readers";
import { refusalText } from "../refusal";
import type { ReaderDetail } from "../types";
import { readerMachine, type Action, type Details } from "./machine";
import "./reader.css";

export function ReaderScreen({
  id,
  selfId,
  notice,
  navigate,
}: {
  id: string;
  /** The signed-in admin: they cannot remove or erase themselves. */
  selfId: string | null;
  /** A message carried over from the previous screen ("Reader added."). */
  notice: string | null;
  navigate: (to: string) => void;
}) {
  const [state, send] = useMachine(readerMachine, { input: { id } });
  const { reader, refusal, action } = state.context;
  const l = labels.admin.reader;

  const back = (
    <button type="button" className="admin-back linklike" onClick={() => navigate("/admin/readers")}>
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

  if (reader === null) {
    return (
      <section className="admin-reader">
        {back}
        <Skeleton height="2.4rem" width="60%" />
        <Skeleton height="10rem" />
      </section>
    );
  }

  const isSelf = selfId === reader.id;

  return (
    <section className="admin-reader">
      {back}
      {notice && <p className="admin-notice" role="status">{notice}</p>}

      <header className="admin-screen-head">
        <h1>{reader.fullName}</h1>
        <StatusPill reader={reader} />
      </header>

      <div className="admin-reader-grid">
        <div className="admin-card">
          <div className="admin-card-head">
            <h2>{l.details}</h2>
            {state.matches({ edit: "viewing" }) || state.matches({ edit: "saved" }) ? (
              !reader.isErased && (
                <Button variant="text" onClick={() => send({ type: "EDIT" })}>{l.edit}</Button>
              )
            ) : null}
          </div>

          {state.matches({ edit: "editing" }) || state.matches({ edit: "saving" }) ? (
            <DetailsForm
              reader={reader}
              saving={state.matches({ edit: "saving" })}
              fieldError={(field) =>
                refusal && refusal.field === field ? refusalText(refusal.code) : undefined}
              formError={refusal && !refusal.field ? refusalText(refusal.code) : undefined}
              onChange={() => send({ type: "CHANGE" })}
              onSave={(details) => send({ type: "SAVE", details })}
              onCancel={() => send({ type: "CANCEL" })}
            />
          ) : (
            <dl className="admin-dl">
              <dt>{l.status}</dt>
              <dd>{reader.isErased ? l.erased : reader.isActive ? l.active : l.inactive}</dd>
              <dt>{labels.admin.form.email}</dt>
              <dd>{reader.email}</dd>
              <dt>{labels.admin.form.phone}</dt>
              <dd>{reader.phone}</dd>
              <dt>{labels.admin.readers.columns.joined}</dt>
              <dd>{formatDate(reader.joinedAt)}</dd>
            </dl>
          )}
          {state.matches({ edit: "saved" }) && <p className="admin-saved" role="status">{l.saved}</p>}
        </div>

        <div className="admin-card">
          <div className="admin-card-head"><h2>{l.books}</h2></div>
          {reader.books.length === 0 ? (
            <p className="admin-muted">{l.noBooks}</p>
          ) : (
            <ul className="admin-books">
              {reader.books.map((book) => (
                <li key={book.title}>
                  <span className="admin-book-title">{book.title}</span>
                  <span className="admin-muted">
                    {labels.pace[paceKey(book.pace)]} · {l.since} {formatDate(book.since)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {!reader.isErased && (
        <Actions
          reader={reader}
          isSelf={isSelf}
          state={actionStateOf(state.value)}
          action={action}
          onAsk={(next) => send({ type: "ASK", action: next })}
          onConfirm={() => send({ type: "CONFIRM" })}
          onKeep={() => send({ type: "KEEP" })}
        />
      )}
    </section>
  );
}

function StatusPill({ reader }: { reader: ReaderDetail }) {
  const badge = labels.admin.readers.badge;
  if (reader.isErased) return <span className="admin-badge admin-badge-off">{badge.erased}</span>;
  if (!reader.isActive) return <span className="admin-badge admin-badge-off">{badge.removed}</span>;
  if (reader.isStaff) return <span className="admin-badge admin-badge-staff">{badge.staff}</span>;
  return null;
}

function DetailsForm({
  reader, saving, fieldError, formError, onChange, onSave, onCancel,
}: {
  reader: ReaderDetail;
  saving: boolean;
  fieldError: (field: string) => string | undefined;
  formError?: string;
  onChange: () => void;
  onSave: (details: Details) => void;
  onCancel: () => void;
}) {
  const [details, setDetails] = useState<Details>({
    fullName: reader.fullName, email: reader.email, phone: reader.phone,
  });
  const l = labels.admin;
  const field = (key: keyof Details, label: string, type = "text") => (
    <>
      <TextField label={label} id={`e-${key}`} type={type} value={details[key]}
        onChange={(e) => {
          setDetails((d) => ({ ...d, [key]: e.target.value }));
          onChange();
        }} />
      {fieldError(key) && <p className="admin-field-error" role="alert">{fieldError(key)}</p>}
    </>
  );

  return (
    <form className="admin-form" onSubmit={(e) => { e.preventDefault(); onSave(details); }}>
      {field("fullName", l.form.fullName)}
      {field("email", l.form.email, "email")}
      {field("phone", l.form.phone, "tel")}
      {formError && <ErrorNotice>{formError}</ErrorNotice>}
      <div className="admin-form-actions">
        <Button type="submit" disabled={saving}>{saving ? l.reader.saving : l.reader.save}</Button>
        <Button type="button" variant="text" onClick={onCancel}>{l.reader.cancel}</Button>
      </div>
    </form>
  );
}

type ActionState = "idle" | "confirming" | "confirmingAgain" | "working" | "failed";
const ACTION_STATES: ActionState[] = ["idle", "confirming", "confirmingAgain", "working", "failed"];

function Actions({
  reader, isSelf, state, action, onAsk, onConfirm, onKeep,
}: {
  reader: ReaderDetail;
  isSelf: boolean;
  state: ActionState;
  action: Action | null;
  onAsk: (action: Action) => void;
  onConfirm: () => void;
  onKeep: () => void;
}) {
  const l = labels.admin.reader;

  if (state === "idle") {
    if (isSelf) return <p className="admin-muted admin-actions">{l.self}</p>;
    return (
      <div className="admin-actions">
        {reader.isActive ? (
          <Button variant="quiet" onClick={() => onAsk("deactivate")}>{l.deactivate}</Button>
        ) : (
          <Button variant="quiet" onClick={() => onAsk("reactivate")}>{l.reactivate}</Button>
        )}
        <Button variant="text" className="admin-danger-text" onClick={() => onAsk("erase")}>
          {l.erase}
        </Button>
      </div>
    );
  }

  const question =
    action === "erase" ? l.eraseConfirm : action === "deactivate" ? l.deactivateConfirm : "";
  const confirmLabel =
    state === "confirmingAgain" ? l.eraseConfirmAgain : action === "erase" ? l.erase : l.confirm;

  return (
    <div className={`admin-confirm ${action === "erase" ? "admin-confirm-danger" : ""}`} role="alertdialog">
      <p>{question}</p>
      {state === "failed" && <p className="admin-field-error">{l.actionError}</p>}
      <div className="admin-form-actions">
        <Button onClick={onConfirm} disabled={state === "working"}
          className={action === "erase" ? "admin-danger" : ""}>
          {state === "working" ? l.working : confirmLabel}
        </Button>
        <Button variant="text" onClick={onKeep} disabled={state === "working"}>{l.keep}</Button>
      </div>
    </div>
  );
}

function actionStateOf(value: unknown): ActionState {
  if (typeof value === "object" && value !== null && "action" in value) {
    const current: unknown = Reflect.get(value, "action");
    const found = ACTION_STATES.find((s) => s === current);
    if (found) return found;
  }
  return "idle";
}

function paceKey(pace: string): keyof typeof labels.pace {
  return pace === "slow" || pace === "fast" ? pace : "medium";
}
