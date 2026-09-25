/**
 * The chamber: the chapter's pages, a quiet bar above them, and the sections
 * drawer (D70, D73).
 *
 * The pages are images the server rendered and watermarked. They cannot be
 * selected, dragged, saved from the menu or printed; the save and print
 * shortcuts do nothing here (D73). A screenshot still works — no web page can
 * stop one — and the watermark is what answers it.
 *
 * The bar carries the chapter's name, a way to jump between sections, and a
 * 2px line that fills as the reader moves through. After a few seconds of
 * reading it fades, and it comes back the moment the reader reaches for it.
 * Nothing in it counts, times, or nudges. A full-screen control (and the `f`
 * key) takes the pages to the edges of the screen (#198).
 */

import { useMachine } from "@xstate/react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { labels } from "../../lib/labels";
import { leaveFullscreen, pdfMachine } from "./machine";
import { PageSkeletons } from "./PageSkeletons";
import { Pages } from "./Pages";
import { activeSection, type Section } from "./position";
import { Sections } from "./Sections";
import { useFullscreenEvents } from "./useFullscreenEvents";
import { useIdle } from "./useIdle";
import { useReadingPosition } from "./useReadingPosition";
import "./PdfChamber.css";

type Props = {
  token: string;
  bookTitle: string;
  title: string;
  /** Rendered after the last page — the end of the chapter belongs to the page. */
  footer?: ReactNode;
  /** Where the line starts, for a reader returning to a chapter (#151). */
  startAt?: number;
  /** The furthest the reader has reached, as it grows. */
  onProgress?: (fraction: number) => void;
};

export function PdfChamber({ token, bookTitle, title, footer, startAt = 0, onProgress }: Props) {
  const [state, send] = useMachine(pdfMachine, { input: { token } });
  const pagesRef = useRef<HTMLDivElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const layout = state.context.layout;
  const position = useReadingPosition(pagesRef, layout?.pages.length ?? 0);
  const idle = useIdle(3000, drawerOpen || !layout);
  useBlockSaveAndPrint();
  useFullscreenEvents(send);
  // Leaving the chapter must never strand the app in full screen (#198).
  useEffect(() => () => leaveFullscreen(), []);
  const immersive = state.matches({ view: "immersive" });

  // The line shows the furthest point reached, not the current one: scrolling
  // back to reread a paragraph should not look like losing ground (D70).
  const [furthest, setFurthest] = useState(startAt);
  useEffect(() => {
    setFurthest((previous) => Math.max(previous, startAt, position.fraction));
  }, [position.fraction, startAt]);
  useEffect(() => {
    onProgress?.(furthest);
  }, [furthest, onProgress]);

  const entries: Section[] = useMemo(() => {
    if (!layout) return [];
    if (layout.sections.length > 0) return layout.sections;
    return layout.pages.map((_, page) => ({
      title: `${labels.reader.page} ${page + 1}`,
      page,
      depth: 0,
    }));
  }, [layout]);

  const goTo = (page: number) => {
    const target = pagesRef.current?.querySelector(`[data-page="${page}"]`);
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    target?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  };

  if (state.matches({ document: "error" })) {
    return (
      <div className="chamber-message" role="alert">
        {/* Says the link is fine, because it is — the document failed, not the
            grant (D43). */}
        <p>{labels.pdf.error}</p>
        <button className="btn-quiet" onClick={() => send({ type: "RETRY" })}>
          {labels.pdf.retry}
        </button>
      </div>
    );
  }

  const percent = Math.round(furthest * 100);

  return (
    <div className="chamber">
      <div className={`chamber-bar${idle ? " faded" : ""}`}>
        <div className="chamber-bar-inner">
          <p className="chamber-bar-title">
            <span className="chamber-bar-book">{bookTitle}</span>
            <span className="chamber-bar-chapter">{title}</span>
          </p>
          <div className="chamber-bar-actions">
          <button
            type="button"
            className="chamber-bar-sections"
            onClick={() => setDrawerOpen(true)}
            disabled={!layout}
          >
            <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" fill="none"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M4 6h12M4 10h12M4 14h8" />
            </svg>
            {labels.reader.sections}
          </button>
          <button
            type="button"
            className="chamber-bar-icon"
            onClick={() => send({ type: "TOGGLE_FULLSCREEN" })}
            aria-pressed={immersive}
            aria-label={immersive ? labels.reader.exitFullscreen : labels.reader.fullscreen}
            title={immersive ? labels.reader.exitFullscreen : labels.reader.fullscreen}
          >
            <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" fill="none"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              {immersive
                ? <path d="M8 3v5H3M12 3v5h5M8 17v-5H3M12 17v-5h5" />
                : <path d="M3 8V3h5M17 8V3h-5M3 12v5h5M17 12v5h-5" />}
            </svg>
          </button>
          </div>
        </div>
        <div
          className="chamber-progress"
          role="progressbar"
          aria-label={labels.reader.progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <span style={{ transform: `scaleX(${furthest})` }} />
        </div>
      </div>

      {/* Shown instead of the chapter if someone prints anyway (D73). */}
      <p className="chamber-print-note">{labels.reader.noPrint}</p>

      {layout ? (
        <>
          <Pages ref={pagesRef} token={token} pages={layout.pages} />
          {footer}
          <Sections
            open={drawerOpen}
            entries={entries}
            active={activeSection(entries, position.page)}
            showPages={layout.sections.length > 0}
            onGo={goTo}
            onClose={() => setDrawerOpen(false)}
          />
        </>
      ) : (
        <>
          <p className="visually-hidden" role="status">{labels.pdf.loading}</p>
          <PageSkeletons />
        </>
      )}
    </div>
  );
}

/**
 * Ctrl/Cmd+P and Ctrl/Cmd+S do nothing while the chamber is open (D73). The
 * browser's own menu can still print, which is why the print stylesheet hides
 * the chapter as well.
 */
function useBlockSaveAndPrint() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && (key === "p" || key === "s")) {
        event.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
