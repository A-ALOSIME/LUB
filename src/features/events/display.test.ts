import {describe, expect, it} from "vitest";
import {eventDay, eventDayEn, eventTime, eventTimeEn} from "./display";

const startsAt = "2026-11-10T18:00:00+03:00";
const nonLatinDigits = /[٠-٩۰-۹]/;

describe("event date and time labels", () => {
  it("formats the date and time as separate Arabic labels with Latin digits", () => {
    expect(eventDay(startsAt)).toContain("10");
    expect(eventTime(startsAt)).toContain("6:00");
    expect(`${eventDay(startsAt)} ${eventTime(startsAt)}`).not.toMatch(nonLatinDigits);
  });

  it("formats the date and time as separate English labels", () => {
    expect(eventDayEn(startsAt)).toContain("Nov");
    expect(eventTimeEn(startsAt)).toContain("6:00");
  });
});
