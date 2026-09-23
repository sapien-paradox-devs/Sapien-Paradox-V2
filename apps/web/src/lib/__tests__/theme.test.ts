import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import indexHtml from "../../../index.html?raw";
import {
  THEME_STORAGE_KEY,
  nextPreference,
  readPreference,
  resolveTheme,
  writePreference,
} from "../theme";

/**
 * An in-memory Storage. Recent Node ships its own `localStorage` global, which
 * shadows jsdom's and has no methods without a backing file — so the tests
 * bring their own rather than depend on which one wins.
 */
function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, value),
  };
}

let storage: Storage;

beforeEach(() => {
  storage = memoryStorage();
  vi.stubGlobal("localStorage", storage);
  Object.defineProperty(window, "localStorage", { value: storage, configurable: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("theme", () => {
  it("cycles system → light → dark → system", () => {
    expect(nextPreference("system")).toBe("light");
    expect(nextPreference("light")).toBe("dark");
    expect(nextPreference("dark")).toBe("system");
  });

  it("follows the device only on system", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("remembers a choice, and forgets it on system", () => {
    writePreference("dark");
    expect(readPreference()).toBe("dark");
    writePreference("system");
    expect(storage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(readPreference()).toBe("system");
  });

  it("ignores a stored value it does not recognise", () => {
    storage.setItem(THEME_STORAGE_KEY, "sepia");
    expect(readPreference()).toBe("system");
  });

  it("falls back to system when storage throws", () => {
    vi.spyOn(storage, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readPreference()).toBe("system");
  });

  it("does not throw when storage refuses a write", () => {
    vi.spyOn(storage, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(() => writePreference("dark")).not.toThrow();
  });

  it("uses the same storage key as the pre-paint script in index.html", () => {
    expect(indexHtml).toContain(`"${THEME_STORAGE_KEY}"`);
  });
});
