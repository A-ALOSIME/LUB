import type { OrganizationProfileSection } from "./local-content";

export type OrganizationProfileGroupKind =
  | "about"
  | "programs"
  | "structure"
  | "activities"
  | "fields"
  | "partnerships"
  | "impact"
  | "membership"
  | "custom";

export type OrganizationProfileGroup = {
  id: string;
  kind: OrganizationProfileGroupKind;
  label: string;
  entries: { index: number; section: OrganizationProfileSection }[];
};

export function organizationSectionTitle(title: string): string {
  const normalized = title.trim();
  const conciseTitles: Record<string, string> = {
    "من IEEE العالمية إلى فرع الجامعة": "IEEE عالميًا",
    "أهداف النادي": "الأهداف",
    "هدفنا وأهداف النادي": "الأهداف",
    "برامج النادي": "البرامج",
    "المجالات التقنية": "المجالات",
    "أبرز أعمال الفرع وإنجازاته": "إنجازات النادي",
    "اللجان والفريق": "اللجان",
    "مهام المسارات التخصصية": "المسارات",
    "قيمة المشاركة والعضوية": "العضوية",
    "فعاليات المجلس عبر الأعوام": "الفعاليات",
    "الهيكل التنظيمي للنادي": "الهيكلة",
    "الهيكل التنظيمي": "الهيكلة",
    "الإدارات واللجان": "اللجان",
    "مجالات عمل المجلس": "المجالات",
    "الأثر والمخرجات": "الأثر",
  };
  if (conciseTitles[normalized]) return conciseTitles[normalized];

  const responsibilityTitle = normalized.match(/^مهام إدارة (.+)$/);
  if (responsibilityTitle) return responsibilityTitle[1];
  if (/^مهام أمين النادي$/.test(normalized)) return "أمين النادي";
  return normalized;
}

function sectionGroupKind(title: string, separateGoals: boolean): OrganizationProfileGroupKind | null {
  if (/^ملاحظة$|^note$/i.test(title.trim())) return null;
  if (separateGoals && /^أهداف النادي$/.test(title.trim())) return "custom";
  if (/رؤية|رسالة|هدف|أهداف|قيم|من نحن|نبذة|الفئة المستهدفة|توجهات المجتمع|كيف يعمل|ما يميز طريقة العمل|قيمة المشاركة والعضوية|اكتشف النادي|من IEEE العالمية|انطلاقة فرع|about|vision|mission|goals|values/i.test(title)) return "about";
  if (/لجان|لجنة|فرق|فريق|هيكل|إدارات|إدارة|أمين النادي|committee|team|structure|administration/i.test(title)) return "structure";
  if (/شركاء|شراكات|شراكة|تعاون|رعاية|partners|partnership|collaboration|sponsor/i.test(title)) return "partnerships";
  if (/أثر|إنجاز|مخرجات|أعمال الفرع|impact|achievement|outcomes/i.test(title)) return "impact";
  if (/فعاليات|فعالية|أنشطة|نشاط|events|activities/i.test(title)) return "activities";
  if (/مجالات|المجال|تقنيات|تخصصات|technology fields|domains/i.test(title)) return "fields";
  if (/مشاركة|عضوية|منافع|membership|participation/i.test(title)) return "membership";
  if (/برامج|برنامج|مسارات|مسار|ورش|معسكر|دورات|تعلم|مساهمة|ماذا نقدم|courses|programs|tracks|workshops|camps|learning|contribution/i.test(title)) return "programs";
  return "custom";
}

function groupLabel(kind: OrganizationProfileGroupKind, entries: OrganizationProfileGroup["entries"]): string {
  const titles = [...new Set(entries.map(({ section }) => section.title))];

  switch (kind) {
    case "about": return "عن الجهة";
    case "programs": return titles.some(title => /مسار|track/i.test(title)) && !titles.some(title => /برامج|برنامج|workshop|camp|courses/i.test(title)) ? "المسارات" : "البرامج";
    case "structure": return titles.some(title => /لجان|لجنة|فرق|فريق|committee|team/i.test(title)) ? "اللجان" : "الهيكلة";
    case "activities": return "الفعاليات";
    case "fields": return "المجالات";
    case "partnerships": return "الشركاء";
    case "impact": return "الإنجازات";
    case "membership": return "العضوية";
    case "custom": return organizationSectionTitle(titles[0]);
  }
}

export function groupOrganizationProfileSections(
  sections: readonly OrganizationProfileSection[],
  options: { mergeFieldsWithPrograms?: boolean; separateGoals?: boolean } = {},
): OrganizationProfileGroup[] {
  const groups = new Map<string, OrganizationProfileGroup>();

  sections.forEach((section, index) => {
    const detectedKind = sectionGroupKind(section.title, Boolean(options.separateGoals));
    if (!detectedKind) return;
    const kind = options.mergeFieldsWithPrograms && detectedKind === "fields" ? "programs" : detectedKind;
    const id = kind === "custom" ? `details-${index}` : kind;
    const group = groups.get(id) ?? { id, kind, label: "", entries: [] };
    group.entries.push({ index, section });
    group.label = groupLabel(group.kind, group.entries);
    groups.set(id, group);
  });

  return [...groups.values()];
}
