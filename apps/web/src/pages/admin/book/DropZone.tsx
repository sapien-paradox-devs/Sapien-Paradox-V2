/** Drop files or a whole folder here, or pick them (D86). Props only. */

import { useRef, useState, type ReactNode } from "react";

import { Button } from "../../../components/Button";
import { filesFromDrop } from "./files";

type Props = {
  title: string;
  hint: string;
  accept: string;
  /** Label for the folder picker; omit for a files-only zone. */
  folderLabel?: string;
  filesLabel: string;
  onFiles: (files: File[]) => void;
  children?: ReactNode;
};

export function DropZone({ title, hint, accept, folderLabel, filesLabel, onFiles, children }: Props) {
  const [over, setOver] = useState(false);
  const folderInput = useRef<HTMLInputElement>(null);
  const filesInput = useRef<HTMLInputElement>(null);

  const take = (list: FileList | null) => {
    if (list && list.length) onFiles(Array.from(list));
  };

  return (
    <div
      className={`admin-drop ${over ? "admin-drop-over" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        void filesFromDrop(e.dataTransfer).then((files) => files.length && onFiles(files));
      }}
    >
      <svg className="admin-drop-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 16V4m0 0-5 5m5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"
          fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p className="admin-drop-title">{title}</p>
      <p className="admin-drop-hint">{hint}</p>
      <div className="admin-drop-actions">
        {folderLabel && (
          <>
            <Button variant="quiet" type="button" onClick={() => folderInput.current?.click()}>
              {folderLabel}
            </Button>
            <input
              ref={folderInput}
              type="file"
              hidden
              // Non-standard but supported by every current browser: pick a folder.
              {...{ webkitdirectory: "", directory: "" }}
              onChange={(e) => {
                take(e.target.files);
                e.target.value = "";
              }}
            />
          </>
        )}
        <Button variant="quiet" type="button" onClick={() => filesInput.current?.click()}>
          {filesLabel}
        </Button>
        <input
          ref={filesInput}
          type="file"
          hidden
          multiple
          accept={accept}
          onChange={(e) => {
            take(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {children}
    </div>
  );
}

/** A single hidden file input behind a button, for one-at-a-time actions. */
export function PickFile({ label, accept, onFile, variant = "text" }: {
  label: string;
  accept: string;
  onFile: (file: File) => void;
  variant?: "solid" | "quiet" | "text";
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button variant={variant} type="button" onClick={() => input.current?.click()}>{label}</Button>
      <input ref={input} type="file" hidden accept={accept} onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) onFile(file);
        e.target.value = "";
      }} />
    </>
  );
}
