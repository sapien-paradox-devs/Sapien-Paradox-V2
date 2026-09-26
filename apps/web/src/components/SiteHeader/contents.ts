/**
 * What the header shows, as data: one answer per (page × session).
 *
 * Kept apart from the component so the table is tested without a DOM.
 */

/** The pages the header can sit above. `library` and `landing` are the two halves of `/`. */
export type HeaderPage =
  | "library"
  | "landing"
  | "reader"
  | "login"
  | "reset"
  | "welcome"
  | "begin"
  | "opening"
  | "admin"
  | "adminLogin"
  | "profile"
  | "unknown";

export type HeaderContents = {
  /** Render nothing at all. */
  hidden: boolean;
  /** "Your library" — a way back from anywhere that is not the library. */
  library: boolean;
  /** Name + sign out. */
  account: boolean;
  signIn: boolean;
  /** "Sign up": buying a book is how an account begins (D47), at `/begin` (#205). */
  signUp: boolean;
};

const NOTHING: HeaderContents = {
  hidden: false,
  library: false,
  account: false,
  signIn: false,
  signUp: false,
};

export function headerContents(page: HeaderPage, signedIn: boolean): HeaderContents {
  switch (page) {
    // `opening` redirects at once, and `unknown` exists so nothing flashes
    // before the first ROUTE (D15). A header there would be exactly that flash.
    case "opening":
    case "unknown":
      return { ...NOTHING, hidden: true };

    case "library":
      return { ...NOTHING, account: true };

    // A visitor can always find both doors (#205).
    case "landing":
      return { ...NOTHING, signIn: true, signUp: true };

    // Already the sign-up page: only the way to sign in instead.
    case "begin":
      return { ...NOTHING, signIn: true };

    // A WhatsApp visitor has no session and must not be pushed towards one:
    // the token alone is enough to read (D7). Only a signed-in reader gets the
    // way back.
    case "reader":
      return { ...NOTHING, library: signedIn };

    // The admin has its own nav; the header keeps the name and sign out (D82).
    case "admin":
      return { ...NOTHING, account: true };

    // Already the sign-in page: only the way to sign up instead.
    case "login":
      return { ...NOTHING, signUp: true };

    // Profile shows a way home and the account avatar (same as library).
    case "profile":
      return { ...NOTHING, account: true, library: true };

    case "reset":
    case "welcome":
    case "adminLogin":
      return NOTHING;
  }
}
