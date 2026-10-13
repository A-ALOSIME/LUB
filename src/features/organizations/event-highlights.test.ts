import { describe, expect, it } from "vitest";
import { selectOrganizationEventHighlights } from "./event-highlights";

const event = (id: string, title: string, featured = false) => ({ id, title, featured });

describe("organization event highlights", () => {
  it("keeps featured events, filters generic introductory meetings, and limits the profile preview", () => {
    const events = [
      event("featured", "اللقاء التعريفي للمجلس", true),
      event("intro", "لقاء تعريفي للمستجدين"),
      event("workshop", "ورشة عملية في الأمن السيبراني"),
      event("competition", "مسابقة تحدي البرمجة"),
      event("showcase", "معرض المشاريع الطلابية"),
    ];

    expect(selectOrganizationEventHighlights(events).map(item => item.id)).toEqual([
      "featured",
      "workshop",
      "competition",
    ]);
  });

  it("shows up to three strong upcoming events when no event is featured", () => {
    const events = [
      event("intro", "اللقاء التعريفي للأندية الطلابية"),
      event("one", "معسكر تطوير التطبيقات"),
      event("two", "ورشة تحليل البيانات"),
      event("three", "معرض المشاريع"),
      event("four", "مسابقة البرمجة"),
    ];

    expect(selectOrganizationEventHighlights(events).map(item => item.id)).toEqual([
      "one",
      "two",
      "three",
    ]);
  });
});
