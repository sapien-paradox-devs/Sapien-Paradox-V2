/**
 * Sending one file's bytes (D85), with real progress.
 *
 * `XMLHttpRequest`, not `fetch`: only XHR reports upload progress. The plan
 * from `POST /api/admin/uploads` says how:
 *
 * - `single`: one PUT straight to R2 on a signed URL.
 * - `multipart`: one PUT per part, in order, each retried up to three times, so
 *   a dropped connection costs one part and not the whole video. R2 answers each
 *   part with an ETag that `complete` needs (the bucket's CORS rule exposes it).
 * - `direct`: no R2 configured, so the bytes go to the API (mandate 6).
 */

import { API_BASE } from "../../../lib/env";
import { csrfHeader } from "../../../lib/fetcher";

export type Plan = {
  ticket: string;
  mode: "single" | "multipart" | "direct";
  url: string | null;
  uploadId: string | null;
  partSize: number | null;
  partUrls: string[] | null;
  contentType: string;
};

export type Part = { partNumber: number; etag: string };

export class TransferError extends Error {
  constructor(public status: number) {
    super(`Transfer failed with ${status}`);
    this.name = "TransferError";
  }
}

type Put = {
  url: string;
  body: Blob;
  headers: Record<string, string>;
  withCredentials?: boolean;
  onProgress: (loaded: number) => void;
  signal: AbortSignal;
};

function put({ url, body, headers, withCredentials, onProgress, signal }: Put): Promise<XMLHttpRequest> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.withCredentials = withCredentials ?? false;
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve(xhr) : reject(new TransferError(xhr.status));
    xhr.onerror = () => reject(new TransferError(0));
    xhr.onabort = () => reject(new TransferError(-1));
    signal.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(body);
  });
}

const PART_ATTEMPTS = 3;

/** Sends `file` as `plan` says. Resolves with the parts for a multipart upload. */
export async function transfer(
  file: Blob,
  plan: Plan,
  onProgress: (loaded: number) => void,
  signal: AbortSignal,
): Promise<Part[] | null> {
  if (plan.mode === "direct") {
    await put({
      url: `${API_BASE}/api/admin/uploads/direct`,
      body: file,
      headers: { "Content-Type": "application/octet-stream", "X-Upload-Ticket": plan.ticket, ...csrfHeader() },
      withCredentials: true,
      onProgress,
      signal,
    });
    return null;
  }

  if (plan.mode === "single" && plan.url) {
    await put({ url: plan.url, body: file, headers: { "Content-Type": plan.contentType }, onProgress, signal });
    return null;
  }

  const size = plan.partSize ?? file.size;
  const urls = plan.partUrls ?? [];
  const parts: Part[] = [];
  let done = 0;

  for (const [index, url] of urls.entries()) {
    const body = file.slice(index * size, (index + 1) * size);
    for (let attempt = 1; ; attempt++) {
      try {
        const xhr = await put({ url, body, headers: {}, onProgress: (loaded) => onProgress(done + loaded), signal });
        const etag = xhr.getResponseHeader("ETag") ?? "";
        parts.push({ partNumber: index + 1, etag });
        done += body.size;
        break;
      } catch (error) {
        if (signal.aborted || attempt >= PART_ATTEMPTS) throw error;
      }
    }
  }
  return parts;
}
