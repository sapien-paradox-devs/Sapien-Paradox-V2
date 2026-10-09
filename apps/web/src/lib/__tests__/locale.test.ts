import { describe, expect, it } from "vitest";

import { formatDay, formatDayISO, t } from "../locale";

describe("t", () => {
  it("reads a label by path", () => {
    expect(t("home.retry")).toBe("Try again");
  });

  it("returns the path itself for a missing key, rather than undefined", () => {
    expect(t("home.greting")).toBe("home.greting");
  });
});

describe("formatDay", () => {
  it("writes a day the way the product writes days", () => {
    const day = formatDay(new Date(2026, 9, 17));

    expect(day).toContain("17");
    expect(day).toContain("Oct");
  });
});

describe("formatDayISO", () => {
  it("accepts what the API sends", () => {
    expect(formatDayISO("2026-10-17T08:00:00+05:30")).toBe(formatDay(new Date(2026, 9, 17)));
  });

  /*
   * A live chapter has no unlock moment, so the row asks for one anyway and
   * gets nothing back rather than "Invalid Date" on the screen.
   */
  it("is empty for null", () => {
    expect(formatDayISO(null)).toBe("");
  });

  it("is empty for a string that is not a date", () => {
    expect(formatDayISO("soon")).toBe("");
  });
});
