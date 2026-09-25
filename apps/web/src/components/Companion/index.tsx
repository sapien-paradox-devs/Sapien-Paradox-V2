/**
 * The companion (D13, D14, D88).
 *
 * A quiet launcher at the bottom right of the chamber, and a panel: beside the
 * pages on a wide screen, a sheet from the bottom on a phone. Closed and silent
 * until the reader opens it: no badge, no pulse, no auto-open (D14). When it
 * opens for the first time, the companion speaks first, with a question (D13).
 */

import { useMachine } from "@xstate/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { labels } from "../../lib/labels";
import { companionMachine, type Pause, type Turn } from "./machine";
import "./Companion.css";

export function Companion({ token, chapterTitle }: { token: string; chapterTitle: string }) {
  const [state, send] = useMachine(companionMachine, { input: { token } });
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLOListElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const l = labels.companion;

  const open = !state.matches("closed");
  const { turns, pause } = state.context;
  const thinking = state.matches("opening") || state.matches("asking");
  const canType = state.matches("idle") || (state.matches("paused") && pause === "tooLong");

  // The page shifts aside for the panel on a wide screen; the stylesheet reads this.
  useEffect(() => {
    const root = document.documentElement;
    if (open) root.dataset.companion = "open";
    else delete root.dataset.companion;
    return () => {
      delete root.dataset.companion;
    };
  }, [open]);

  // Esc closes, from anywhere, and focus goes back to the launcher.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        send({ type: "CLOSE" });
        launcherRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, send]);

  // The newest turn is always in view.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [turns.length, thinking]);

  useEffect(() => {
    if (canType) inputRef.current?.focus({ preventScroll: true });
  }, [canType]);

  const submit = () => {
    if (!draft.trim() || !canType) return;
    send({ type: "ASK", question: draft });
    setDraft("");
    // Back to one line: the box grew with the message that just left.
    if (inputRef.current) inputRef.current.style.height = "auto";
  };

  return (
    <>
      {!open && (
        <button ref={launcherRef} type="button" className="companion-launcher" onClick={() => send({ type: "OPEN" })}>
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h7A2.5 2.5 0 0 1 16 5.5v5a2.5 2.5 0 0 1-2.5 2.5H9l-3.5 3v-3A2.5 2.5 0 0 1 4 10.5z" />
          </svg>
          <span className="companion-launcher-long">{l.open}</span>
          <span className="companion-launcher-short">{l.openShort}</span>
        </button>
      )}

      {open && (
        <>
          {/* Phones only: a tap outside the sheet closes it. */}
          <div className="companion-backdrop" onClick={() => send({ type: "CLOSE" })} aria-hidden="true" />
          <aside className="companion" role="dialog" aria-label={l.open} aria-modal="false">
            <span className="companion-handle" aria-hidden="true" />
            <header className="companion-head">
              <div>
                <p className="companion-eyebrow">{l.eyebrow}</p>
                <p className="companion-title">{chapterTitle}</p>
              </div>
              <button type="button" className="companion-close" aria-label={l.close} title={l.close}
                onClick={() => send({ type: "CLOSE" })}>
                <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" fill="none"
                  stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <path d="M5 5l10 10M15 5L5 15" />
                </svg>
              </button>
            </header>

            <ol ref={listRef} className="companion-turns" aria-live="polite">
              {turns.map((turn, index) => <TurnView key={index} turn={turn} />)}
              {thinking && (
                <li className="companion-turn companion-turn-companion companion-thinking" aria-label={l.thinking}>
                  <span /><span /><span />
                </li>
              )}
              {state.matches("askFailed") && (
                <li className="companion-status" role="alert">
                  {l.error} <button type="button" onClick={() => send({ type: "RETRY" })}>{l.retry}</button>
                </li>
              )}
              {state.matches("openingFailed") && (
                <li className="companion-status" role="alert">
                  {l.openingError} <button type="button" onClick={() => send({ type: "RETRY" })}>{l.retry}</button>
                </li>
              )}
              {state.matches("paused") && pause && (
                <li className="companion-status companion-status-calm" role="status">{pauseText(pause)}</li>
              )}
            </ol>

            <form className="companion-compose" onSubmit={(e) => { e.preventDefault(); submit(); }}>
              <div className="companion-field">
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={draft}
                  placeholder={l.placeholder}
                  aria-label={l.placeholder}
                  disabled={!canType}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    grow(e.target);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      submit();
                    }
                  }}
                />
                <button type="submit" className="companion-send" aria-label={l.send} title={l.send}
                  disabled={!canType || !draft.trim()}>
                  <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" fill="none"
                    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 16V4M5 9l5-5 5 5" />
                  </svg>
                </button>
              </div>
              <p className="companion-note">{l.note}</p>
            </form>
          </aside>
        </>
      )}
    </>
  );
}

function TurnView({ turn }: { turn: Turn }) {
  return (
    <li className={`companion-turn companion-turn-${turn.role}`}>
      <span className="visually-hidden">
        {turn.role === "companion" ? labels.companion.companion : labels.companion.you}:{" "}
      </span>
      {turn.text}
    </li>
  );
}

function pauseText(pause: Exclude<Pause, null>): string {
  const l = labels.companion;
  return { capped: l.capped, unavailable: l.unavailable, notReady: l.notReady, tooLong: l.tooLong }[pause];
}

/** The box grows with what is typed, up to about six lines, then scrolls. */
function grow(area: HTMLTextAreaElement) {
  area.style.height = "auto";
  area.style.height = `${Math.min(area.scrollHeight, 160)}px`;
}
