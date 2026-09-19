/**
 * #90. `env.ts` reads `import.meta.env` at module load, so each case needs a fresh
 * module — hence `resetModules` and a dynamic import rather than a top-level one.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

async function loadWith(env: Record<string, unknown>) {
  vi.resetModules();
  vi.stubGlobal("import.meta.env", env);
  for (const [key, value] of Object.entries(env)) {
    vi.stubEnv(key, value as string);
  }
  return import("../env");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("API_BASE", () => {
  it("uses VITE_API_BASE when it is set", async () => {
    const { API_BASE } = await loadWith({ VITE_API_BASE: "https://api.example.com", PROD: true });
    expect(API_BASE).toBe("https://api.example.com");
  });

  it("strips a trailing slash, so joining a path never doubles it", async () => {
    const { API_BASE } = await loadWith({ VITE_API_BASE: "https://api.example.com/", PROD: true });
    expect(API_BASE).toBe("https://api.example.com");
  });

  it("falls back to the deployed API in production when nothing is set", async () => {
    const { API_BASE } = await loadWith({ VITE_API_BASE: "", PROD: true });
    expect(API_BASE).toBe("https://sapien-api.onrender.com");
  });

  it("stays empty in development, so Vite's proxy is not bypassed", async () => {
    const { API_BASE } = await loadWith({ VITE_API_BASE: "", PROD: false });
    expect(API_BASE).toBe("");
  });
});
