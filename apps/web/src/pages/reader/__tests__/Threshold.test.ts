import { describe, expect, it } from "vitest";

import { toRoman } from "../Threshold";

describe("toRoman", () => {
  it("numbers chapters the way a printed book does", () => {
    expect(toRoman(1)).toBe("I");
    expect(toRoman(4)).toBe("IV");
    expect(toRoman(9)).toBe("IX");
    expect(toRoman(14)).toBe("XIV");
    expect(toRoman(40)).toBe("XL");
  });

  it("falls back to digits for anything a book would not number", () => {
    expect(toRoman(0)).toBe("0");
    expect(toRoman(2.5)).toBe("2.5");
  });
});
