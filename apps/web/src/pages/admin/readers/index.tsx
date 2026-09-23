/** Admin · Readers (D82): everyone, searchable, with a way to add one. */

import { useMachine } from "@xstate/react";

import { Button } from "../../../components/Button";
import { ErrorNotice } from "../../../components/ErrorNotice";
import { Skeleton } from "../../../components/Skeleton";
import { labels } from "../../../lib/labels";
import type { ReaderRow, ReaderStatus } from "../types";
import { readersMachine } from "./machine";
import "./readers.css";

const STATUSES: ReaderStatus[] = ["all", "active", "inactive"];

export function ReadersScreen({ navigate }: { navigate: (to: string) => void }) {
  const [state, send] = useMachine(readersMachine);
  const { readers, search, status } = state.context;
  const l = labels.admin.readers;

  return (
    <section className="admin-readers">
      <header className="admin-screen-head">
        <h1>{l.title}</h1>
        <Button onClick={() => navigate("/admin/readers/new")}>{l.add}</Button>
      </header>

      <div className="admin-readers-tools">
        <input
          type="search"
          className="admin-search"
          placeholder={l.search}
          aria-label={l.search}
          value={search}
          onChange={(e) => send({ type: "SEARCH", search: e.target.value })}
        />
        <div className="admin-segments" role="radiogroup">
          {STATUSES.map((key) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={status === key}
              className="admin-segment"
              onClick={() => send({ type: "STATUS", status: key })}
            >
              {l.status[key]}
            </button>
          ))}
        </div>
      </div>

      {state.matches("error") ? (
        <ErrorNotice action={l.retry} onAction={() => send({ type: "RETRY" })}>
          {l.loadError}
        </ErrorNotice>
      ) : state.matches("loading") && readers.length === 0 ? (
        <div className="admin-table-skeleton">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} height="3rem" />)}
        </div>
      ) : readers.length === 0 ? (
        <p className="admin-empty">{l.empty}</p>
      ) : (
        <table className="admin-table" aria-busy={!state.matches("ready")}>
          <thead>
            <tr>
              <th>{l.columns.name}</th>
              <th>{l.columns.contact}</th>
              <th className="admin-num">{l.columns.books}</th>
              <th>{l.columns.joined}</th>
            </tr>
          </thead>
          <tbody>
            {readers.map((reader) => (
              <ReaderRowView key={reader.id} reader={reader}
                onOpen={() => navigate(`/admin/readers/${reader.id}`)} />
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function ReaderRowView({ reader, onOpen }: { reader: ReaderRow; onOpen: () => void }) {
  const badge = labels.admin.readers.badge;
  return (
    <tr className="admin-row" onClick={onOpen}>
      <td>
        {/* The row is clickable for the mouse; this button is the keyboard's way in. */}
        <button type="button" className="admin-row-name"
          onClick={(e) => { e.stopPropagation(); onOpen(); }}>
          {reader.fullName}
        </button>
        {reader.isStaff && <span className="admin-badge admin-badge-staff">{badge.staff}</span>}
        {reader.isErased ? (
          <span className="admin-badge admin-badge-off">{badge.erased}</span>
        ) : !reader.isActive && (
          <span className="admin-badge admin-badge-off">{badge.removed}</span>
        )}
      </td>
      <td className="admin-contact">
        <span>{reader.email}</span>
        <span>{reader.phone}</span>
      </td>
      <td className="admin-num">{reader.bookCount}</td>
      <td className="admin-date">{formatDate(reader.joinedAt)}</td>
    </tr>
  );
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
