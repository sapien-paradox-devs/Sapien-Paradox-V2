export type Context = {
  chapterId: string;
  /** Set once the exchange succeeds; the page redirects to it. */
  token: string | null;
};

export type Event =
  /** Sent by the page once the root machine's session region settles (D44). */
  | { type: "SESSION_SETTLED"; authenticated: boolean }
  | { type: "RETRY" };
