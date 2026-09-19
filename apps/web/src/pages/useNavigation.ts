/**
 * How a page reads session state and asks to move.
 *
 * A page calls `send({ type: "NAVIGATE", to })` rather than touching history
 * itself, so every URL change goes through the one path in `actions.pushUrl`.
 */

import { createContext, useContext } from "react";

import type { User } from "./machine";

export type Navigation = {
  user: User | null;
  /** False while the boot session check is still in flight. */
  sessionSettled: boolean;
  navigate: (to: string) => void;
  /** A page reporting a successful sign-in. The root owns what happens next. */
  authenticated: (user: User) => void;
  logout: () => void;
};

export const NavigationContext = createContext<Navigation | null>(null);

export function useNavigation(): Navigation {
  const navigation = useContext(NavigationContext);

  if (navigation === null) {
    throw new Error("useNavigation must be used inside the Navigator");
  }

  return navigation;
}
