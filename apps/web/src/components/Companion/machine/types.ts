/** One turn of the conversation, as the panel shows it and the API receives it (#202). */
export type Turn = { role: "reader" | "companion"; text: string };

/** Why the companion is not answering. Each is a calm state, not an error (D45). */
export type Pause = "capped" | "unavailable" | "notReady" | "tooLong" | null;

export type Context = {
  token: string;
  turns: Turn[];
  /** The reader's message in flight, kept so a failed send can be retried unchanged. */
  pending: string;
  pause: Pause;
};

export type Event =
  | { type: "OPEN" }
  | { type: "CLOSE" }
  | { type: "ASK"; question: string }
  | { type: "RETRY" };
