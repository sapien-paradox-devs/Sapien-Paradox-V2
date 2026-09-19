/**
 * The Navigator — level 0's only component.
 *
 * Runs the root machine, keeps the URL in sync, and renders one page per state.
 * It holds no logic of its own: which page shows is a machine state, and what
 * happens inside a page belongs to that page (D15).
 */

import { useMachine } from "@xstate/react";
import { useEffect, useMemo } from "react";

import { HomePage } from "./home";
import { LandingPage } from "./landing";
import { LoginPage } from "./login";
import { OpeningPage } from "./opening";
import { ReaderPage } from "./reader";
import { ResetPage } from "./reset";
import { WelcomePage } from "./welcome";
import { navigationMachine } from "./machine";
import { startRouteSync } from "./machine/sync";
import { NavigationContext, type Navigation } from "./useNavigation";

export function Navigator() {
  const [state, send] = useMachine(navigationMachine);

  useEffect(() => startRouteSync(send), [send]);

  const navigation = useMemo<Navigation>(
    () => ({
      user: state.context.user,
      sessionSettled: !state.matches({ session: "checking" }),
      navigate: (to: string) => send({ type: "NAVIGATE", to }),
      authenticated: (user) => send({ type: "AUTHENTICATED", user }),
      logout: () => send({ type: "LOGOUT" }),
    }),
    [state, send],
  );

  // `page.unknown` renders nothing on purpose: it stops Home flashing before
  // sync.ts delivers the first ROUTE on mount (D15).
  //
  let page = null;

  // `/` is two pages. An authenticated reader gets their library; a visitor
  // gets the page that sells them a book (D47). While the session region is
  // still `checking` this renders nothing rather than guessing -- guessing
  // would flash the landing page at a reader who is already signed in, which
  // is the same mistake D44 forbids on the opening page.
  const sessionChecking = state.matches({ session: "checking" });
  const signedIn = state.matches({ session: "authenticated" });

  if (state.matches({ page: "login" })) page = <LoginPage />;
  else if (state.matches({ page: "welcome" })) page = <WelcomePage />;
  else if (state.matches({ page: "home" })) {
    if (!sessionChecking) page = signedIn ? <HomePage /> : <LandingPage />;
  }
  else if (state.matches({ page: "opening" })) page = <OpeningPage />;
  else if (state.matches({ page: "reader" })) page = <ReaderPage />;
  else if (state.matches({ page: "reset" })) page = <ResetPage />;

  return (
    <NavigationContext.Provider value={navigation}>
      {page}
    </NavigationContext.Provider>
  );
}

