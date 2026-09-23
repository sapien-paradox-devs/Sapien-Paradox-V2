/**
 * The sections drawer (D71): the PDF's bookmarks, or its pages when it has
 * none. A native <dialog>, so focus is held inside it, Escape closes it, and
 * focus returns to the button that opened it — without code to do any of that.
 */

import { useEffect, useRef } from "react";

import { labels } from "../../lib/labels";
import type { Section } from "./position";

export function Sections({
  open,
  entries,
  active,
  showPages,
  onGo,
  onClose,
}: {
  open: boolean;
  entries: Section[];
  /** Index into `entries`, or -1. */
  active: number;
  /** False when the entries are the pages themselves ("Page 2 … 2" says it twice). */
  showPages: boolean;
  onGo: (page: number) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className="chamber-sections"
      aria-labelledby="chamber-sections-title"
      onClose={onClose}
      // A click on the dialog itself, not its contents, is a click on the backdrop.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="chamber-sections-inner">
        <header>
          <h2 id="chamber-sections-title">{labels.reader.sectionsTitle}</h2>
          <button type="button" className="chamber-sections-close" onClick={onClose}>
            {labels.reader.close}
          </button>
        </header>
        <ol>
          {entries.map((entry, index) => (
            <li key={`${entry.page}-${index}`}>
              <button
                type="button"
                aria-current={index === active ? "location" : undefined}
                style={{ paddingLeft: `calc(var(--space-4) + ${entry.depth * 0.9}rem)` }}
                onClick={() => {
                  onGo(entry.page);
                  onClose();
                }}
              >
                <span>{entry.title}</span>
                {showPages && <span className="chamber-sections-page">{entry.page + 1}</span>}
              </button>
            </li>
          ))}
        </ol>
      </div>
    </dialog>
  );
}
