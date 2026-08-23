import { createMachine } from "xstate";
import type { Context, Event } from "./types";

/**
 * Root machine — level 0.
 *
 * Owns exactly two things: session state, and which page is showing.
 * Everything else belongs to a page machine.
 *
 * The two regions are PARALLEL and independent. `session.checking` +
 * `page.reader` is a valid state — that is precisely a WhatsApp visitor
 * opening a token link on a phone with no cookie. Because the page region
 * never waits on the session region, a token link can never be redirected
 * to /login by a pending auth check (DESIGN.md D1).
 */
export const navigationMachine = createMachine({
  types: {} as { context: Context; events: Event },
  id: "navigation",
  type: "parallel",

  context: {
    user: null,
  },

  on: {
    // sync.ts is the only sender: mount, popstate, and after any pushUrl.
    ROUTE: [
      { guard: "isReaderPath", target: ".page.reader" },
      { guard: "isLoginPath", target: ".page.login" },
      { guard: "isOpeningPath", target: ".page.opening" },
      { target: ".page.home" },
    ],

    // Navigation is unidirectional: pages ask for a URL, the URL drives state.
    // No target here — pushUrl fires ROUTE back through sync.ts.
    NAVIGATE: {
      actions: "pushUrl",
    },
  },

  states: {
    session: {
      initial: "checking",
      states: {
        checking: {
          invoke: {
            src: "checkSession",
            onDone: { target: "authenticated", actions: "assignUser" },
            onError: { target: "anonymous" },
          },
        },

        anonymous: {
          on: {
            AUTHENTICATED: {
              target: "authenticated",
              actions: ["assignUser", "goToHome"],
            },
          },
        },

        authenticated: {
          on: {
            LOGOUT: { target: "loggingOut" },
          },
        },

        loggingOut: {
          invoke: {
            src: "logoutActor",
            // Local session is cleared either way — a failed logout call
            // must not strand the user in an authenticated-looking UI.
            onDone: {
              target: "anonymous",
              actions: ["clearUser", "goToLogin"],
            },
            onError: {
              target: "anonymous",
              actions: ["clearUser", "goToLogin"],
            },
          },
        },
      },
    },

    page: {
      // `unknown` renders nothing. It exists so the app does not flash Home
      // before sync.ts delivers the first ROUTE on mount.
      initial: "unknown",
      states: {
        unknown: {},
        home: {},
        login: {},
        opening: {},
        reader: {},
      },
    },
  },
});
