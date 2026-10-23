import { describe, expect, it } from "vitest";
import { groupOrganizationProfileSections, hasOrganizationSectionContent, orderOrganizationTabs, organizationSectionTitle } from "./section-groups";
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
    ].map(section => ({ ...section, body: "محتوى القسم" })));

    expect(groups.map(group => group.kind)).toEqual(["about", "programs", "activities", "partnerships", "structure"]);
    expect(groups[0].entries.map(entry => entry.index)).toEqual([0, 1]);
    expect(groups[1].entries.map(entry => entry.index)).toEqual([2, 3]);
    expect(groups[4].entries.map(entry => entry.index)).toEqual([4, 5]);
    expect(groups[4].label).toBe("اللجان");
    expect(groups[2].label).toBe("الفعاليات");
    expect(groups[3].label).toBe("الشركاء");
  });

  it("gives IEEE the same separate programs and fields tabs as every other organization", () => {
    const ieee = localOrganizationContent("نادي IEEE", "Club")!;
    const groups = groupOrganizationProfileSections(ieee.sections);
    const programs = groups.find(group => group.id === "programs");

    expect(groups.find(group => group.id === "fields")?.label).toBe("المجالات");
    expect(programs?.label).toBe("البرامج");
    expect(programs?.entries.map(({ section }) => section.title)).toEqual(["برامج النادي"]);
  });

  it("groups Dhaheer goals and OSS details under the common organization overview", () => {
    const dhaheer = localOrganizationContent("نادي ظهير", "Club")!;
    const dhaheerGroups = groupOrganizationProfileSections(dhaheer.sections);
    expect(dhaheerGroups.map(group => [group.kind, group.label])).toEqual([["about", "عن الجهة"]]);

    const oss = localOrganizationContent("مجتمع OSS", "Club")!;
    const ossGroups = groupOrganizationProfileSections(oss.sections);
    expect(ossGroups.find(group => group.id === "about")?.entries.map(({ section }) => section.title)).toEqual(["أهداف المجتمع", "المجتمع"]);
    expect(ossGroups.find(group => group.label === "عن الجهة")?.entries.map(({ section }) => section.title)).toEqual(["أهداف المجتمع", "المجتمع"]);
  });

  it("shortens long section titles without changing their saved content", () => {
    expect(organizationSectionTitle("من IEEE العالمية إلى فرع الجامعة")).toBe("IEEE عالميًا");
    expect(organizationSectionTitle("أبرز أعمال الفرع وإنجازاته")).toBe("الإنجازات");
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
      const expectedIndexes = profile!.sections.flatMap((section, index) => /^ملاحظة$|^note$/i.test(section.title.trim()) || !hasOrganizationSectionContent(section) ? [] : [index]);

      expect(indexes, name).toEqual(expectedIndexes);
    }
  });
});

it("omits title-only, whitespace-only and empty highlighted sections", () => {
  expect(groupOrganizationProfileSections([{ title: "الشركاء", body: "  " }, { title: "البرامج", items: [] }, { title: "الإنجازات", highlightsOnly: true, items: [{ title: "غير مميز" }] }])).toEqual([]);
  expect(groupOrganizationProfileSections([{ title: "الشركاء", image: { src: "/partners.png", alt: "الشركاء", width: 100, height: 100 } }]).map(group => group.id)).toEqual(["partnerships"]);
});
it("keeps names and order fixed independently of content insertion order, with committees last", () => {
  const sections = [{ title: "الشركاء", body: "شريك" }, { title: "الهيكل التنظيمي", body: "لجنة" }, { title: "إنجازات النادي", body: "إنجاز" }, { title: "المسارات", body: "برنامج" }];
  const first = groupOrganizationProfileSections(sections).map(({ id, label }) => ({ id, label }));
  expect(groupOrganizationProfileSections([...sections].reverse()).map(({ id, label }) => ({ id, label }))).toEqual(first);
  expect(first).toEqual([{ id: "programs", label: "البرامج" }, { id: "impact", label: "الإنجازات" }, { id: "partnerships", label: "الشركاء" }, { id: "structure", label: "اللجان" }]);
  expect(orderOrganizationTabs([{ id: "structure" }, { id: "applications" }, { id: "about" }, { id: "partnerships" }]).map(tab => tab.id)).toEqual(["about", "applications", "partnerships", "structure"]);
});
