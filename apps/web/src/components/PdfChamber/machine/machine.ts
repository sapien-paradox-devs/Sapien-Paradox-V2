/**
 * PdfChamber — level 2.
 *
 * It earns a machine because it owns async work with a lifecycle independent of
 * its page (D15), and it keeps **its own error** (D43).
 *
 * A grant can resolve perfectly and the document still fail — a broken byte
 * range, a network blip. Folding that into the reader page's error would tell a
 * reader whose link is fine that their link is broken, and offer them sanctuary,
 * which cannot help.
 *
 * Two parallel regions (D42): `document` is the chapter loading, and `view` is
 * whether the reader has gone full screen (#198). They are independent: a
 * reader can go full screen while the pages are still arriving.
 */

import type { Context } from "./types";

export const pdfConfig = {
  id: "pdf",
  type: "parallel",
  context: { token: "", layout: null } as Context,

  states: {
    document: {
      initial: "loading",
      states: {
        loading: {
          invoke: {
            src: "loadLayout",
            input: ({ context }: { context: Context }) => ({ token: context.token }),
            onDone: { target: "rendered", actions: "assignLayout" },
            onError: { target: "error" },
          },
        },
        rendered: {},
        error: { on: { RETRY: { target: "loading" } } },
      },
    },

    // Full screen is a request, not a guarantee: the browser may refuse, and an
    // iPhone has no Fullscreen API for pages at all. `immersive` holds either
    // way, so the layout (no site header, pages to the edges) does not depend
    // on the browser agreeing.
    view: {
      initial: "normal",
      states: {
        normal: {
          on: { TOGGLE_FULLSCREEN: { target: "immersive", actions: "enterFullscreen" } },
        },
        immersive: {
          on: {
            TOGGLE_FULLSCREEN: { target: "normal", actions: "leaveFullscreen" },
            FULLSCREEN_EXITED: { target: "normal", actions: "dropImmersive" },
          },
          // No `exit` action for leaving the chapter: XState does not run exit
          // actions when an actor stops. PdfChamber cleans up on unmount instead.
        },
      },
    },
  },
} as const;
