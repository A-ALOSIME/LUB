import { expect, it } from "vitest";
import { formatRiyadhDate, formatRiyadhDateTime } from "./datetime";

it("formats timestamps in readable Riyadh time without an offset", () => {
  const formatted = formatRiyadhDateTime("2026-10-21T09:00:00.000Z", "ar");
  expect(formatted).not.toContain("الأربعاء");
  expect(formatRiyadhDateTime("2026-10-21T09:00:00.000Z","ar",true)).toContain("الأربعاء");
  expect(formatted).toContain("21 أكتوبر 2026");
  expect(formatted).toContain("12:00 م");
  expect(formatted).not.toMatch(/[+-]03:00|GMT/);
});

it("treats date-only and local date-time values as Riyadh wall time", () => {
  expect(formatRiyadhDate("2026-10-21", "ar")).toContain("21 أكتوبر 2026");
  expect(formatRiyadhDateTime("2026-10-21T12:00", "ar")).toContain("12:00 م");
  expect(formatRiyadhDateTime("2026-10-21T12:00", "en")).toContain("12:00 pm");
});

it("keeps compact table periods on days and months in Riyadh with Western digits",async()=>{
 const {formatRiyadhPeriod}=await import("./datetime");expect(formatRiyadhPeriod("2026-10-27T09:00:00Z","2026-10-30T20:59:00Z","ar")).toBe("27–30 أكتوبر");expect(formatRiyadhPeriod("2026-10-29","2026-11-01","en")).toBe("29 October – 1 November");
});
