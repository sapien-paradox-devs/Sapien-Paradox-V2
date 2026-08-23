import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

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
  server: {
    port: 5173,
    fs: { allow: [fileURLToPath(new URL("../..", import.meta.url))] },
  },
});
