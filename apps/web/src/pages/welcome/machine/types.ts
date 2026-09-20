export type Outcome = {
  status: "fulfilled" | "pending" | "refused";
  delivered: boolean;
  detail: string;
};

export type Context = {
  delivered: boolean;
  detail: string;
};

export type Event = { type: "never" };
