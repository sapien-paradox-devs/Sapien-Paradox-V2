/** Every upload in one place, so a long batch can be watched from any section (D85). */

import { Button } from "../../../components/Button";
import { labels } from "../../../lib/labels";
import { UploadStatus } from "./Chapters";
import type { UploadItem } from "./machine/types";
import type { Send } from "./shared";

export function Uploads({ uploads, send }: { uploads: UploadItem[]; send: Send }) {
  const l = labels.admin.book;
  if (uploads.length === 0) return null;
  const finished = uploads.filter((u) => u.status === "done").length;

  return (
    <aside className="admin-uploads" aria-label={l.uploads}>
      <header>
        <span>{l.uploads} · {finished}/{uploads.length}</span>
        {finished > 0 && <Button variant="text" onClick={() => send({ type: "CLEAR_UPLOADS" })}>{l.clearDone}</Button>}
      </header>
      <ul>
        {uploads.map((u) => (
          <li key={u.id}>
            <span className="admin-upload-name">{u.title || u.file.name}</span>
            <UploadStatus upload={u} pdf={u.target.destination === "new_chapter" || u.target.destination === "chapter_pdf"} />
            {u.status === "failed" && (
              <Button variant="text" onClick={() => send({ type: "RETRY_UPLOAD", id: u.id })}>{l.retryUpload}</Button>
            )}
          </li>
        ))}
      </ul>
    </aside>
  );
}
