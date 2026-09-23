/**
 * The Navigator — level 0's only component.
 *
 * Runs the root machine, keeps the URL in sync, and renders one page per state.
 * It holds no logic of its own: which page shows is a machine state, and what
 * happens inside a page belongs to that page (D15).
 */

import { useMachine } from "@xstate/react";
import { useEffect, useMemo } from "react";

import { SiteHeader } from "../components/SiteHeader";
import type { HeaderPage } from "../components/SiteHeader/contents";
import { ThemeToggle } from "../components/ThemeToggle";
import { BootSkeleton } from "./BootSkeleton";
import { HomePage } from "./home";
import { LandingPage } from "./landing";
import { LoginPage } from "./login";
import { OpeningPage } from "./opening";
import { ReaderPage } from "./reader";
import { ResetPage } from "./reset";
import { WelcomePage } from "./welcome";
import { BeginPage } from "./begin";
import { AdminPage } from "./admin";
import { AdminLoginPage } from "./admin-login";
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
      authenticated: (user, next) => send({ type: "AUTHENTICATED", user, next }),
      logout: () => send({ type: "LOGOUT" }),
    }),
    [state, send],
  );

  // `page.unknown` renders nothing on purpose: it stops Home flashing before
  // sync.ts delivers the first ROUTE on mount (D15).
  //
  let page = null;
  let headerPage: HeaderPage = "unknown";

  // `/` is two pages. An authenticated reader gets their library; a visitor
  // gets the page that sells them a book (D47). While the session region is
  // still `checking` this renders nothing rather than guessing -- guessing
  // would flash the landing page at a reader who is already signed in, which
  // is the same mistake D44 forbids on the opening page.
  const sessionChecking = state.matches({ session: "checking" });
  const signedIn = state.matches({ session: "authenticated" });

  if (state.matches({ page: "login" })) {
    page = <LoginPage />;
    headerPage = "login";
  } else if (state.matches({ page: "begin" })) {
    page = <BeginPage />;
    headerPage = "begin";
  } else if (state.matches({ page: "welcome" })) {
    page = <WelcomePage />;
    headerPage = "welcome";
  } else if (state.matches({ page: "home" })) {
    // Neither page until the session says which (D44), but never a blank
    // screen while it decides (#161).
    if (sessionChecking) page = <BootSkeleton />;
    else {
      page = signedIn ? <HomePage /> : <LandingPage />;
      headerPage = signedIn ? "library" : "landing";
    }
  } else if (state.matches({ page: "opening" })) {
    page = <OpeningPage />;
    headerPage = "opening";
  } else if (state.matches({ page: "reader" })) {
    page = <ReaderPage />;
    headerPage = "reader";
  } else if (state.matches({ page: "reset" })) {
    page = <ResetPage />;
    headerPage = "reset";
  } else if (state.matches({ page: "adminLogin" })) {
    page = <AdminLoginPage />;
    headerPage = "adminLogin";
  } else if (state.matches({ page: "admin" })) {
    page = <AdminPage />;
    headerPage = "admin";
  }

  return (
    <NavigationContext.Provider value={navigation}>
      {/* Layout, not logic: which items it shows is a pure function of the
          page and the session, both already decided above. */}
      <SiteHeader
        page={headerPage}
        userName={signedIn ? (state.context.user?.fullName ?? null) : null}
        navigate={navigation.navigate}
        onLogout={navigation.logout}
        trailing={<ThemeToggle />}
      />
      {page}
    </NavigationContext.Provider>
  );
}

