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
  password: string;
};

export type OrderDetails = {
  orderId: string;
  keyId: string;
  amount: number;
  currency: string;
  bookTitle: string;
};

export type Context = {
  books: Book[];
  orderDetails: OrderDetails | null;
  signup: Signup | null;
};

export type Event =
  | { type: "RETRY" }
  | { type: "SUBMIT"; signup: Signup };
