/**
 * The chapter's companion video (D76). A quiet link under the title; the player
 * opens only when asked for, and never starts on its own — nothing moves while
 * the reader is reading.
 *
 * Plays straight from a short-lived signed URL (D77). The URL is held by the
 * machine only while the player is open.
 */

import { labels } from "../../lib/labels";

export type VideoState = "idle" | "fetching" | "playing" | "failed";

type Props = {
  state: VideoState;
  url: string | null;
  onWatch: () => void;
  onClose: () => void;
};

export function ChapterVideo({ state, url, onWatch, onClose }: Props) {
  if (state === "idle") {
    return (
      <button type="button" className="reader-video-open" onClick={onWatch}>
        {labels.reader.video.watch}
      </button>
    );
  }

  return (
    <figure className="reader-video">
      {state === "fetching" && <p className="reader-video-note">{labels.reader.video.loading}</p>}

      {state === "failed" && (
        <p className="reader-video-note" role="alert">
          {labels.reader.video.error}{" "}
          <button type="button" onClick={onWatch}>{labels.reader.video.retry}</button>
        </p>
      )}

      {state === "playing" && url && (
        // No autoplay: the reader pressed play once already, by opening it.
        <video src={url} controls playsInline preload="metadata" controlsList="nodownload" />
      )}

      <button type="button" className="reader-video-close" onClick={onClose}>
        {labels.reader.video.close}
      </button>
    </figure>
  );
}
