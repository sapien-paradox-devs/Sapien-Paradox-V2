/**
 * `/r/:token` — the chamber. The only page reachable without a session, which
 * is what makes a WhatsApp link work on a phone with no cookie.
 */

import { useMachine } from "@xstate/react";

import { Companion } from "../../components/Companion";
import { PdfChamber } from "../../components/PdfChamber";
import { labels } from "../../lib/labels";
import { readerMachine } from "./machine";
import { Sanctuary } from "./Sanctuary";
import { Threshold, type ThresholdBeat } from "./Threshold";
import "./reader.css";

type ReissueState = "idle" | "sending" | "sent" | "limited" | "failed";

const REISSUE_STATES: ReissueState[] = ["idle", "sending", "sent", "limited", "failed"];

const BEATS: ThresholdBeat[] = ["gathering", "titled", "ruled", "lifting"];

export function ReaderPage() {
  const token = window.location.pathname.split("/r/")[1] ?? "";
  const [state, send] = useMachine(readerMachine, { input: { token } });

  if (state.matches({ chamber: "sanctuary" })) {
    return (
      <Sanctuary
        reissue={reissueStateOf(state.value)}
        onReissue={() => send({ type: "REISSUE" })}
      />
    );
  }

  if (state.matches({ chamber: "denied" })) {
    return <main role="alert">{labels.reader.denied}</main>;
  }

  if (state.matches({ chamber: "error" })) {
    return (
      <main role="alert">
        {labels.reader.error}{" "}
        <button onClick={() => send({ type: "RETRY" })}>{labels.reader.retry}</button>
      </main>
    );
  }

  if (state.matches({ chamber: "loading" })) {
    return <main>{labels.reader.loading}</main>;
  }

  const chapter = state.context.chapter;
  const beat = thresholdBeatOf(state.value);

  return (
    <>
    {/* The chamber renders underneath from the first beat, so the pages load
        while the ceremony plays (#116). */}
    {beat && chapter && (
      <Threshold chapter={chapter} beat={beat} onSkip={() => send({ type: "SKIP" })} />
    )}
    <main className="reader">
      {chapter && (
        <header>
          <p>{chapter.bookTitle}</p>
          <h1>{chapter.title}</h1>
        </header>
      )}

      <PdfChamber token={token} />

      <Companion token={token} />

      {state.matches({ chamber: "finished" }) ? (
        <p>{labels.reader.finished}</p>
      ) : (
        <button onClick={() => send({ type: "FINISH" })}>
          {labels.reader.finish}
        </button>
      )}
    </main>
    </>
  );
}

/** Which beat of the threshold is showing, or null outside it. No cast. */
function thresholdBeatOf(value: unknown): ThresholdBeat | null {
  if (typeof value !== "object" || value === null || !("chamber" in value)) return null;
  const { chamber } = value;
  if (typeof chamber !== "object" || chamber === null || !("threshold" in chamber)) return null;
  const { threshold } = chamber;
  return BEATS.find((candidate) => candidate === threshold) ?? null;
}

/** Reads the parallel region's state without a cast. */
function reissueStateOf(value: unknown): ReissueState {
  if (typeof value === "object" && value !== null && "reissue" in value) {
    const { reissue } = value;
    const found = REISSUE_STATES.find((candidate) => candidate === reissue);
    if (found) return found;
  }
  return "idle";
}
