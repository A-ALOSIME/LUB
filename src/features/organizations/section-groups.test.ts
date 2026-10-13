import { describe, expect, it } from "vitest";
import { groupOrganizationProfileSections, organizationSectionTitle } from "./section-groups";
import { localOrganizationContent } from "./local-content";

describe("groupOrganizationProfileSections", () => {
  it("groups profile content into concise about, program, structure and activity pages", () => {
    const groups = groupOrganizationProfileSections([
      { title: "أهداف النادي" },
      { title: "الرؤية والرسالة" },
      { title: "برامج النادي" },
      { title: "معسكرات النادي" },
      { title: "لجنة الميديا", collapsible: true },
      { title: "الهيكل التنظيمي" },
      { title: "فعاليات المجلس عبر الأعوام" },
      { title: "الشركاء" },
      { title: "ملاحظة", body: "معلومة تحريرية" },
    ]);

    expect(groups.map(group => group.kind)).toEqual(["about", "programs", "structure", "activities", "partnerships"]);
    expect(groups[0].entries.map(entry => entry.index)).toEqual([0, 1]);
    expect(groups[1].entries.map(entry => entry.index)).toEqual([2, 3]);
    expect(groups[2].entries.map(entry => entry.index)).toEqual([4, 5]);
    expect(groups[2].label).toBe("اللجان");
    expect(groups[3].label).toBe("الفعاليات");
    expect(groups[4].label).toBe("الشركاء");
  });

  it("merges IEEE programs and technical fields under one short page", () => {
    const ieee = localOrganizationContent("نادي IEEE", "Club")!;
    const groups = groupOrganizationProfileSections(ieee.sections, { mergeFieldsWithPrograms: true });
    const programs = groups.find(group => group.id === "programs");

    expect(groups.some(group => group.id === "fields")).toBe(false);
    expect(programs?.label).toBe("البرامج");
    expect(programs?.entries.map(({ section }) => section.title)).toEqual(["برامج النادي", "المجالات التقنية"]);
  });

  it("can place Dhaheer goals on their own page and group OSS community details", () => {
    const dhaheer = localOrganizationContent("نادي ظهير", "Club")!;
    const dhaheerGroups = groupOrganizationProfileSections(dhaheer.sections, { separateGoals: true });
    expect(dhaheerGroups.map(group => [group.kind, group.label])).toEqual([["custom", "الأهداف"]]);

    const oss = localOrganizationContent("مجتمع OSS", "Club")!;
    const ossGroups = groupOrganizationProfileSections(oss.sections);
    expect(ossGroups.find(group => group.id === "about")?.entries.map(({ section }) => section.title)).toEqual(["أهداف المجتمع"]);
    expect(ossGroups.find(group => group.label === "المجتمع")?.entries.map(({ section }) => section.title)).toEqual(["المجتمع"]);
  });

  it("shortens long section titles without changing their saved content", () => {
    expect(organizationSectionTitle("من IEEE العالمية إلى فرع الجامعة")).toBe("IEEE عالميًا");
    expect(organizationSectionTitle("أبرز أعمال الفرع وإنجازاته")).toBe("إنجازات النادي");
    expect(organizationSectionTitle("اللجان والفريق")).toBe("اللجان");
    expect(organizationSectionTitle("مهام المسارات التخصصية")).toBe("المسارات");
  });

  it("assigns every published local club and council section to a page", () => {
    const organizations = [
      ["المجلس الاستشاري الطلابي لقسم علوم الحاسب", "Council"],
      ["المجلس الاستشاري الطلابي لقسم نظم المعلومات", "Council"],
      ["نادي إنجاز", "Club"],
      ["نادي الأمن السيبراني", "Club"],
      ["نادي IEEE", "Club"],
      ["نادي تكنيشن", "Club"],
      ["نادي طويق", "Club"],
      ["نادي ظهير", "Club"],
      ["نادي RobotX", "Club"],
      ["مجتمع OSS", "Club"],
      ["المجلس الاستشاري الطلابي لقسم تقنية المعلومات", "Council"],
      ["المجلس الطلابي", "Council"],
    ] as const;

    for (const [name, typeCode] of organizations) {
      const profile = localOrganizationContent(name, typeCode);
      expect(profile, name).toBeTruthy();
      const groups = groupOrganizationProfileSections(profile!.sections);
      const indexes = groups.flatMap(group => group.entries.map(entry => entry.index)).sort((a, b) => a - b);
      const expectedIndexes = profile!.sections.flatMap((section, index) => /^ملاحظة$|^note$/i.test(section.title.trim()) ? [] : [index]);

      expect(indexes, name).toEqual(expectedIndexes);
    }
  });
});
