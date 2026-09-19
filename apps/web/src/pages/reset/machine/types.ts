export type Context = {
  /** From the URL. Fixed for the life of the page, so it arrives as input. */
  token: string;
  errorMessage: string | null;
  /** True once the link itself is spent — retrying cannot help, so the form goes away. */
  linkDead: boolean;
};

export type Event =
  | { type: "SUBMIT"; password: string; confirm: string }
  /** Typing clears the error rather than scolding as you fix it. */
  | { type: "EDIT" };

export type ResetInput = {
  token: string;
};
