import { describe, expect, it } from "vitest";

import { avatarSvg, avatarDataUrl } from "../avatar";

describe("avatarSvg", () => {
  it("returns the same SVG for the same seed", () => {
    expect(avatarSvg("ada@example.com", 28)).toBe(avatarSvg("ada@example.com", 28));
  });

  it("returns different SVGs for different seeds", () => {
    expect(avatarSvg("ada@example.com", 28)).not.toBe(avatarSvg("bob@example.com", 28));
  });

  it("produces a valid SVG string", () => {
    const svg = avatarSvg("test", 40);
    expect(svg).toMatch(/^<svg /);
    expect(svg).toMatch(/<\/svg>$/);
    expect(svg).toContain('viewBox="0 0 1 1"');
  });

  it("respects the size parameter", () => {
    expect(avatarSvg("test", 64)).toContain('width="64"');
    expect(avatarSvg("test", 64)).toContain('height="64"');
  });

  it("uses colours from the Jewel palette", () => {
    const palette = ["#2952e3", "#f5a623", "#ff6b57", "#14b8a6"];
    const svg = avatarSvg("test", 28);
    const usesKnownColour = palette.some((c) => svg.includes(c));
    expect(usesKnownColour).toBe(true);
  });
});

describe("avatarDataUrl", () => {
  it("returns a data: URI", () => {
    expect(avatarDataUrl("test", 28)).toMatch(/^data:image\/svg\+xml,/);
  });
});
