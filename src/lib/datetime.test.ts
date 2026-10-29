import { expect, it } from "vitest";
import { formatRiyadhDate, formatRiyadhDateTime } from "./datetime";

it("formats timestamps in readable Riyadh time without an offset", () => {
  const formatted = formatRiyadhDateTime("2026-10-21T09:00:00.000Z", "ar");
  expect(formatted).not.toContain("الأربعاء");
  expect(formatRiyadhDateTime("2026-10-21T09:00:00.000Z","ar",true)).toContain("الأربعاء");
  expect(formatted).toContain("٢١ أكتوبر ٢٠٢٦");
  expect(formatted).toContain("١٢:٠٠ م");
  expect(formatted).not.toMatch(/[+-]03:00|GMT/);
});

it("treats date-only and local date-time values as Riyadh wall time", () => {
  expect(formatRiyadhDate("2026-10-21", "ar")).toContain("٢١ أكتوبر ٢٠٢٦");
  expect(formatRiyadhDateTime("2026-10-21T12:00", "ar")).toContain("١٢:٠٠ م");
  expect(formatRiyadhDateTime("2026-10-21T12:00", "en")).toContain("12:00 pm");
});
