import { describe, expect, it } from "vitest";
import { formatPersonalDate, formatPersonalNumber } from "./personal-display";

describe("personal dashboard formatting", () => {
  it("formats Arabic dates with Western digits", () => {
    const value = formatPersonalDate("2026-11-01", "ar");

    expect(value).toContain("2026");
    expect(value).toContain("1");
    expect(value).not.toMatch(/[٠-٩۰-۹]/);
  });

  it("formats dashboard counts with Western digits in Arabic", () => {
    expect(formatPersonalNumber(1234, "ar")).toBe("1,234");
    expect(formatPersonalNumber(3.5, "ar")).toBe("3.5");
  });
});
