export type Book = {
  slug: string;
  title: string;
  priceMinorUnits: number;
  chapterCount: number;
};

export type Signup = {
  fullName: string;
  email: string;
  phone: string;
  bookSlug: string;
  pace: string;
};

export type Context = {
  books: Book[];
  /** Set once checkout succeeds; the page redirects the browser to it. */
  paymentUrl: string | null;
};

export type Event =
  | { type: "RETRY" }
  | { type: "SUBMIT"; signup: Signup };
