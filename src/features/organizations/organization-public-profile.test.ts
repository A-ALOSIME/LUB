import { describe, expect, it } from "vitest";
import { localOrganizationContent } from "./local-content";
import { buildOrganizationProfilePresentation } from "./organization-public-profile";

describe("organization public profile presentation", () => {
  it("keeps curated council and club details when optional content is blank", () => {
    for (const [name, type, expected] of [
      ["المجلس الاستشاري لعلوم الحاسب", "Council", "ماذا نقدم؟"],
      ["نادي طويق", "Club", "الهيكل التنظيمي للنادي"],
      ["نادي ظهير", "Club", "أهداف النادي"],
    ] as const) {
      const curated = localOrganizationContent(name, type);
      const result = buildOrganizationProfilePresentation({ curated, saved: {}, mission: "", memberCount: 4 });
      expect(result.sections.some(section => section.title === expected)).toBe(true);
      expect(result.stats?.some(stat => stat.label === "عضو" && stat.value === "4")).toBe(true);
    }
  });

  it("uses entered values to replace the matching curated section and adds the partner image", () => {
    const curated = localOrganizationContent("المجلس الاستشاري لعلوم الحاسب", "Council");
    const result = buildOrganizationProfilePresentation({
      curated,
      saved: { offerings: "ورش تطبيقية\nاستشارات طلابية", partners: "جامعة الإمام", partnersImageUrl: "https://storage.example/partners.png", annualEventCount: "12" },
      mission: "",
      memberCount: 7,
    });

    const offerings = result.sections.find(section => section.title === "ماذا نقدم؟");
    expect(offerings?.items?.map(item => item.title)).toEqual(["ورش تطبيقية", "استشارات طلابية"]);
    expect(result.sections.find(section => section.title === "الشركاء")?.image?.src).toBe("https://storage.example/partners.png");
    expect(result.stats).toContainEqual({ value: "12", label: "فعالية سنوية" });
    expect(result.stats).toContainEqual({ value: "7", label: "عضو" });
  });
});
