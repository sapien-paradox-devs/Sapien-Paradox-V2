/**
 * One chapter: open it, a quiet read/unread mark — not a progress bar (D11) —
 * and a send-to-WhatsApp action.
 */

import { locale } from "../../lib/locale";
import { Button } from "../Button";

export type Chapter = {
  id: string;
  number: number;
  title: string;
  /** A quiet mark, not a progress bar (D11). */
  read: boolean;
};

export type ChapterRowProps = {
  chapter: Chapter;
  sending: boolean;
  onOpen: () => void;
  onSend: () => void;
};

export function ChapterRow({ chapter, sending, onOpen, onSend }: ChapterRowProps) {
  return (
    <li className="chapter-row">
      <button className="chapter-row-open" onClick={onOpen}>
        {locale("home.chapter")} {chapter.number} — {chapter.title}
      </button>

      {chapter.read && (
        <span className="chapter-row-mark" aria-label={locale("home.read")}>
          ·
        </span>
      )}

      <Button variant="secondary" onClick={onSend} disabled={sending}>
        {sending ? locale("home.sending") : locale("home.send")}
      </Button>
    </li>
  );
}
