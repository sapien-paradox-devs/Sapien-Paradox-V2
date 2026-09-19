export type Exchange = { question: string; answer: string };

export type Context = {
  token: string;
  exchanges: Exchange[];
  /** Kept so a failed question can be retried without retyping it. */
  pending: string;
};

export type Event =
  | { type: "OPEN" }
  | { type: "CLOSE" }
  | { type: "ASK"; question: string }
  | { type: "RETRY" };
