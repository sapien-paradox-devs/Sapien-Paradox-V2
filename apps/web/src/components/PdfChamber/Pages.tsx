/**
 * The chapter's pages, as images the server rendered and watermarked (D73).
 *
 * Every page gets a box of the right shape at once, so the scroll height is
 * true before anything loads and the progress line never jumps. A page's image
 * is fetched when it comes within two screens of the viewport and released
 * when it goes further, so a long chapter on a phone never holds every image.
 *
 * Images arrive as blob URLs, never as API or storage URLs in an <img src>:
 * there is no address on the page that could be opened or saved on its own.
 */

import { forwardRef, useEffect, useRef, useState } from "react";

import { mappedFetcher } from "../../lib/fetcher";
import type { PageSize } from "./machine";

type Props = { token: string; pages: PageSize[] };

export const Pages = forwardRef<HTMLDivElement, Props>(function Pages({ token, pages }, ref) {
  const inner = useRef<HTMLDivElement | null>(null);
  const [near, setNear] = useState<Set<number>>(() => new Set([0]));

  useEffect(() => {
    const root = inner.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) =>
        setNear((previous) => {
          const next = new Set(previous);
          for (const entry of entries) {
            if (!(entry.target instanceof HTMLElement)) continue;
            const index = Number(entry.target.dataset.page);
            if (entry.isIntersecting) next.add(index);
            else next.delete(index);
          }
          return next;
        }),
      { rootMargin: "200% 0px" },
    );
    root.querySelectorAll<HTMLElement>(".pdf-page").forEach((page) => observer.observe(page));
    return () => observer.disconnect();
  }, [pages]);

  return (
    <div
      className="pdf-pages"
      ref={(node) => {
        inner.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      // No "Save image as…", no dragging a page out to the desktop (D73).
      onContextMenu={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
    >
      {pages.map((size, index) => (
        <Page key={index} token={token} index={index} size={size} near={near.has(index)} />
      ))}
    </div>
  );
});

function Page({
  token,
  index,
  size,
  near,
}: {
  token: string;
  index: number;
  size: PageSize;
  near: boolean;
}) {
  const url = usePageImage(token, index, near);

  return (
    <div
      // A page shimmers until its image arrives, then the image fades in (#161).
      className={`pdf-page${url ? "" : " is-loading"}`}
      data-page={index}
      style={{ aspectRatio: `${size.width} / ${size.height}` }}
    >
      {url && <img src={url} alt="" draggable={false} />}
    </div>
  );
}

/** The page's image as a blob URL while it is near the viewport; null otherwise. */
function usePageImage(token: string, index: number, near: boolean): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!near) return;
    let cancelled = false;
    let created: string | null = null;

    mappedFetcher
      .blob(`/api/grants/${token}/pages/${index + 1}`)
      .then((blob) => {
        if (cancelled) return;
        created = URL.createObjectURL(blob);
        setUrl(created);
      })
      .catch(() => {
        // The box stays blank; scrolling it out and back in tries again.
      });

    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
      setUrl(null);
    };
  }, [token, index, near]);

  return url;
}

