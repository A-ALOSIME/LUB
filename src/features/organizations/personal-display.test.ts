import { describe, expect, it } from "vitest";
import { formatPersonalDate, formatPersonalNumber } from "./personal-display";

describe("personal dashboard formatting", () => {
  it("formats Arabic dates with Arabic digits", () => {
    const value = formatPersonalDate("2026-11-01", "ar");

    expect(value).toContain("٢٠٢٦");
    expect(value).toContain("١");
    expect(value).not.toMatch(/[0-9]/);
  });

  it("formats dashboard counts with Arabic digits in Arabic", () => {
    expect(formatPersonalNumber(1234, "ar")).toBe("١٬٢٣٤");
    expect(formatPersonalNumber(3.5, "ar")).toBe("٣٫٥");
  });
});
