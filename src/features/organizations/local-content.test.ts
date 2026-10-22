import { describe, expect, it } from "vitest";
import { localOrganizationContent } from "./local-content";

describe("local organization profile matching", () => {
  it("retains the curated About information for the Computer Science council, Tuwaiq, and Zaheer", () => {
    const computerCouncil = localOrganizationContent("المجلس الاستشاري لعلوم الحاسب", "Council");
    const tuwaiq = localOrganizationContent("نادي طويق", "Club");
    const zaheer = localOrganizationContent("نادي ظهير", "Club");

    expect(computerCouncil?.about).toContain("حلقة وصل بين طلبة قسم علوم الحاسب");
    expect(computerCouncil?.sections.some(section => section.title === "ماذا نقدم؟")).toBe(true);
    expect(tuwaiq?.vision).toContain("الخيار الأول");
    expect(tuwaiq?.sections.some(section => section.title === "الهيكل التنظيمي للنادي")).toBe(true);
    expect(zaheer?.vision).toContain("منصة رائدة");
    expect(zaheer?.sections.some(section => section.title === "أهداف النادي")).toBe(true);
  });

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

  it("keeps only selected IEEE achievement highlights in the profile presentation", () => {
    const ieee = localOrganizationContent("نادي IEEE", "Club");
    const achievements = ieee?.sections.find(section => section.title === "أبرز أعمال الفرع وإنجازاته");

    expect(achievements?.highlightsOnly).toBe(true);
    expect(achievements?.items?.filter(item => item.highlighted).map(item => item.title)).toEqual([
      "IEEE Xtreme",
      "Saudi CPC",
      "ركن النادي في DevFest",
      "معسكر علم البيانات",
      "معسكر الواقع المعزز",
      "ورش تقنية عن بُعد",
    ]);

    for (const item of achievements?.items?.filter(item => item.highlighted) ?? []) {
      expect(`${item.title} ${item.body ?? ""}`).not.toMatch(/[—]|\b20\d{2}\b|\b\d{1,2}[-–/]\d{1,2}\b/);
    }
  });

  it("groups Information Systems council activities by year and folds national-day participation into recurring activities", () => {
    const council = localOrganizationContent("المجلس الاستشاري الطلابي لقسم نظم المعلومات", "Council");
    const events = council?.sections.find(section => section.title === "فعاليات المجلس عبر الأعوام");

    expect(events?.items?.filter(item => item.highlighted).map(item => item.title)).toEqual([
      "1446هـ",
      "1447هـ",
      "مشاركات سنوية",
    ]);
    expect(council?.sections.some(section => section.title.includes("1448"))).toBe(false);
    expect(events?.items?.[2]?.body).toMatch(/سنويًا.*الفعاليات الوطنية/);
    expect(events?.items?.flatMap(item => [item.title, item.body ?? ""]).join(" ")).not.toMatch(/[—]|\b20\d{2}\b|اليوم الوطني السادس والتسعين/);
  });

  it("uses the transparent cyber security mark for the dedicated profile crop", () => {
    const cyberSecurity = localOrganizationContent("نادي الأمن السيبراني", "Club");

    expect(cyberSecurity?.logoSrc).toBe("/club-logos/cybersec.webp");
    expect(cyberSecurity?.eventLogoSrc).toBe("/club-logos/cybersec-avatar.webp");
    expect(cyberSecurity?.imageTheme).toBe("cybersec");
  });

  it("presents the Information Technology council poster content as text and keeps Dhaheer free of duplicate posters", () => {
    const council = localOrganizationContent("المجلس الاستشاري الطلابي لقسم تقنية المعلومات", "Council");
    const dhaheer = localOrganizationContent("نادي ظهير", "Club");

    expect(council?.sections.some(section => section.title === "الرؤية والرسالة" && section.body?.includes("بناء بيئة تعليمية محفزة") === true)).toBe(true);
    expect(council?.sections.some(section => section.image?.src === "/organization-media/information-technology-council-poster.webp")).toBe(false);
    expect(council?.sections.find(section => section.title === "مجالات عمل المجلس")?.items).toHaveLength(4);
    expect(dhaheer?.sections.some(section => section.image)).toBe(false);
  });

  it("uses the student council introduction PDF for its computer science profile", () => {
    const council = localOrganizationContent("المجلس الاستشاري الطلابي لقسم علوم الحاسب", "Council");
    const offerings = council?.sections.find(section => section.title === "ماذا نقدم؟");

    expect(council?.about).toContain("حلقة وصل بين طلبة قسم علوم الحاسب والقسم");
    expect(council?.mission).toContain("حلقة وصل فاعلة");
    expect(offerings?.items?.map(item => item.title)).toHaveLength(7);
  });
  it("uses the supplied RobotX logo and keeps its intro separate from annual details", () => {
    const robotx = localOrganizationContent("نادي RobotX", "Club");
    const directions = robotx?.sections.find(section => section.title === "اتجاهات العمل");
    const goals = robotx?.sections.find(section => section.title === "الأهداف السنوية");

    expect(robotx?.logoSrc).toBe("/club-logos/robotx-logo-2026.webp");
    expect(robotx?.coverSrc).toBeUndefined();
    expect(robotx?.summary).toBeUndefined();
    expect(robotx?.about).toBeUndefined();
    expect(robotx?.vision).toContain("المرجع الأول داخل الجامعة");
    expect(directions?.items).toHaveLength(4);
    expect(goals?.items).toHaveLength(8);
    expect(robotx?.links?.map(link => link.href)).toContain("mailto:robot.23.club@gmail.com");
  });
});
