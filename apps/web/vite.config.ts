import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
// `vitest/config` rather than `vite`: it is what types the `test` key below.
import { defineConfig } from "vitest/config";

// `shared/` sits outside this app's root (D20). Only the monorepo makes that possible —
// two repos would need a published package for nine values.
const shared = fileURLToPath(new URL("../../shared", import.meta.url));

export default defineConfig({
  plugins: [react()],
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
  },
});
