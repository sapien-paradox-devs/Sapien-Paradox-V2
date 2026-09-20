export type Outcome = {
  status: "fulfilled" | "pending" | "refused";
  delivered: boolean;
  detail: string;
};

export type ResendOutcome = {
  status: "sent" | "pending" | "refused" | "throttled";
  chapterSent: boolean;
  passwordSent: boolean;
  detail: string;
};

export type Context = {
  delivered: boolean;
  detail: string;
  /** Set once a resend has been attempted, so the page reports what happened. */
  resend: ResendOutcome | null;
};

export type Event = { type: "RESEND" };
