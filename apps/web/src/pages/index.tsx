/**
 * The Navigator — level 0's only component.
 *
 * Runs the root machine, keeps the URL in sync, and renders one page per state.
 * It holds no logic of its own: which page shows is a machine state, and what
 * happens inside a page belongs to that page (D15).
 */

import { useMachine } from "@xstate/react";
import { useEffect, useMemo } from "react";

import { LoginPage } from "./login";
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
  // Each page arrives in its own slice — #29 home, #30 opening, #31 reader —
  // and replaces its placeholder here.
  let page = null;

  if (state.matches({ page: "login" })) page = <LoginPage />;
  else if (state.matches({ page: "home" })) page = <Placeholder name="home" />;
  else if (state.matches({ page: "opening" })) page = <Placeholder name="opening" />;
  else if (state.matches({ page: "reader" })) page = <Placeholder name="reader" />;

  return (
    <NavigationContext.Provider value={navigation}>
      {page}
    </NavigationContext.Provider>
  );
}

/** Stands in until each page slice lands. Carries no copy, so no labels yet. */
function Placeholder({ name }: { name: string }) {
  return <div data-page={name} />;
}
