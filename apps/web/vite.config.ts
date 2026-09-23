import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
// `vitest/config` rather than `vite`: it is what types the `test` key below.
import { defineConfig } from "vitest/config";
import type { Plugin } from "vite";

// `shared/` sits outside this app's root (D20). Only the monorepo makes that possible —
// two repos would need a published package for nine values.
const shared = fileURLToPath(new URL("../../shared", import.meta.url));

/**
 * Fills `__APP_URL__` in index.html. The share card's og:image must be an
 * absolute URL (#119), and index.html is the one place that cannot import
 * `lib/env.ts`.
 *
 * `VITE_APP_URL` wins when set. Otherwise a Vercel build uses the project's
 * production domain, which Vercel provides to every build — so nothing is
 * hardcoded here, unlike `lib/env.ts`'s API fallback (#90). Anywhere else
 * (a local build, a fresh clone) it falls back to relative URLs: the app works,
 * only link previews lack an image. Mandate 6: a fresh clone needs no config.
 */
function appUrl(): Plugin {
  const resolve = () => {
    const configured = process.env.VITE_APP_URL;
    if (configured) return configured.replace(/\/$/, "");
    const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
    if (vercel) return `https://${vercel}`;
    return "";
  };

  return {
    name: "app-url",
    transformIndexHtml: (html) => html.replaceAll("__APP_URL__", resolve()),
  };
}

export default defineConfig({
  plugins: [react(), appUrl()],
  resolve: {
    alias: {
      "@shared": shared,
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // The root machine's navigation actions touch window.history, so tests need
    // a DOM rather than bare node.
    environment: "jsdom",
  },
  server: {
    port: 5173,
    fs: { allow: [fileURLToPath(new URL("../..", import.meta.url))] },
    // `lib/env.ts` leaves API_BASE empty in development *because* this proxy
    // exists — same-origin there, absolute in production (D6). Without it every
    // call resolves against Vite, which answers `/api/...` with index.html: a
    // 200 of text/html that fails at `response.json()` and surfaces as
    // "we could not reach the library" on every screen.
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
