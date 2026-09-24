import type { Event, UploadItem } from "./machine/types";

export type Send = (event: Event) => void;

/** 0–100 for a progress bar. */
export function percent(upload: UploadItem): number {
  if (upload.status === "finishing" || upload.status === "done") return 100;
  return upload.file.size ? Math.min(100, Math.round((upload.loaded / upload.file.size) * 100)) : 0;
}

export function fill(template: string, n: number): string {
  return template.replace("{n}", String(n));
}

export function megabytes(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
