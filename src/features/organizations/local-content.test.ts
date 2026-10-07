import { describe, expect, it } from "vitest";
import { localOrganizationContent } from "./local-content";

describe("local organization profile matching", () => {
  it("uses the current Information Technology student council profile without the outdated duplicate", () => {
    const outdatedCouncil = localOrganizationContent("المجلس الاستشاري لتقنية المعلومات", "Council");
    const studentCouncil = localOrganizationContent("المجلس الاستشاري الطلابي لقسم تقنية المعلومات", "Council");

    expect(outdatedCouncil).toBeUndefined();
    expect(studentCouncil?.logoSrc).toBe("/club-logos/information-technology-student-council.webp");
    expect(studentCouncil?.links?.map(link => link.href)).toContain("mailto:sacit.imamu@gmail.com");
  });

  it("points the Information Systems council icons at its social accounts", () => {
    const council = localOrganizationContent("المجلس الاستشاري الطلابي لقسم نظم المعلومات", "Council");
    const hrefs = council?.links?.map(link => link.href) ?? [];

    expect(hrefs).toContain("https://www.tiktok.com/@ccis_sac");
    expect(hrefs).toContain("https://www.linkedin.com/company/ccis-sac");
    expect(hrefs).toContain("https://x.com/CCIS_SAC");
    expect(hrefs.filter(href => href === "https://imamusac.com/contact")).toHaveLength(0);
  });

  it("presents the Information Technology council poster content as text and keeps Dhaheer free of duplicate posters", () => {
    const council = localOrganizationContent("المجلس الاستشاري الطلابي لقسم تقنية المعلومات", "Council");
    const dhaheer = localOrganizationContent("نادي ظهير", "Club");

    expect(council?.sections.some(section => section.title === "الرؤية والرسالة" && section.body?.includes("بناء بيئة تعليمية محفزة") === true)).toBe(true);
    expect(council?.sections.some(section => section.image?.src === "/organization-media/information-technology-council-poster.webp")).toBe(false);
    expect(council?.sections.find(section => section.title === "مجالات عمل المجلس")?.items).toHaveLength(4);
    expect(dhaheer?.sections.some(section => section.image)).toBe(false);
  });
});
