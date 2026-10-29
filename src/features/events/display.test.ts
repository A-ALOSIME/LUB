import {describe, expect, it} from "vitest";
import {eventDay, eventDayEn, eventTime, eventTimeEn} from "./display";

const startsAt = "2026-11-10T18:00:00+03:00";
const latinDigits = /[0-9]/;

describe("event date and time labels", () => {
  it("formats the date and time as separate Arabic labels with Arabic digits", () => {
    expect(eventDay(startsAt)).toContain("١٠");
    expect(eventTime(startsAt)).toContain("٦:٠٠");
    expect(`${eventDay(startsAt)} ${eventTime(startsAt)}`).not.toMatch(latinDigits);
  });

  it("formats the date and time as separate English labels", () => {
    expect(eventDayEn(startsAt)).toContain("Nov");
    expect(eventTimeEn(startsAt)).toContain("6:00");
  });
});
