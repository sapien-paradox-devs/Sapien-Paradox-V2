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
 */

import type { Context } from "./types";

export const pdfConfig = {
  id: "pdf",
  initial: "loading",
  context: { token: "", layout: null } as Context,

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
} as const;
