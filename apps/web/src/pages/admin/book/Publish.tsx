/** Publish (D84): a checklist, then a deliberate button. */

import { Button } from "../../../components/Button";
import { labels } from "../../../lib/labels";
import type { BookDetail } from "../types";
import type { Send } from "./shared";

export function Publish({ book, working, send }: { book: BookDetail; working: boolean; send: Send }) {
  const l = labels.admin.book;
  const items: [keyof typeof l.checklist, boolean][] = [
    ["hasChapters", book.checklist.hasChapters],
    ["allReady", book.checklist.allReady],
    ["hasCover", book.checklist.hasCover],
  ];

  if (book.isPublished) {
    return (
      <div className="admin-publish">
        <p>{l.unpublishLead}</p>
        <Button variant="quiet" disabled={working} onClick={() => send({ type: "RUN", op: { kind: "unpublish" } })}>
          {l.unpublish}
        </Button>
      </div>
    );
  }

  return (
    <div className="admin-publish">
      <ul className="admin-checklist">
        {items.map(([name, ok]) => (
          <li key={name} className={ok ? "admin-check-ok" : ""}>
            <span className="admin-check-mark" aria-hidden="true">{ok ? "✓" : ""}</span>
            {l.checklist[name]}
          </li>
        ))}
      </ul>
      <p className="admin-muted">{l.publishLead}</p>
      <Button disabled={!book.checklist.passes || working}
        onClick={() => send({ type: "RUN", op: { kind: "publish" } })}>
        {working ? l.publishing : l.publish}
      </Button>
    </div>
  );
}
