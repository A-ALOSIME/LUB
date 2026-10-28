import type { OrganizationProfileSection } from "./local-content";

export type OrganizationProfileGroupKind =
  | "about"
  | "programs"
  | "structure"
  | "activities"
  | "fields"
  | "partnerships"
  | "impact"
  | "membership";

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
    "أبرز أعمال الفرع وإنجازاته": "الإنجازات",
    "إنجازات النادي/المجلس": "الإنجازات",
    "إنجازات النادي": "الإنجازات",
    "إنجازات المجلس": "الإنجازات",
    "أهداف النادي/المجلس": "الأهداف",
    "أهداف المجلس": "الأهداف",
    "اللجان والفريق": "اللجان",
    "مهام المسارات التخصصية": "المسارات",
    "قيمة المشاركة والعضوية": "العضوية",
    "فعاليات المجلس عبر الأعوام": "الفعاليات",
    "الهيكل التنظيمي للنادي": "اللجان",
    "الهيكل التنظيمي": "اللجان",
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

function sectionGroupKind(title: string): OrganizationProfileGroupKind | null {
  if (/^ملاحظة$|^note$/i.test(title.trim())) return null;
  if (/رؤية|رسالة|هدف|أهداف|قيم|من نحن|نبذة|الفئة المستهدفة|توجهات المجتمع|كيف يعمل|ما يميز طريقة العمل|قيمة المشاركة والعضوية|اكتشف النادي|من IEEE العالمية|انطلاقة فرع|about|vision|mission|goals|values/i.test(title)) return "about";
  if (/لجان|لجنة|فرق|فريق|هيكل|إدارات|إدارة|أمين النادي|committee|team|structure|administration/i.test(title)) return "structure";
  if (/شركاء|شراكات|شراكة|تعاون|رعاية|partners|partnership|collaboration|sponsor/i.test(title)) return "partnerships";
  if (/أثر|إنجاز|مخرجات|أعمال الفرع|impact|achievement|outcomes/i.test(title)) return "impact";
  if (/فعاليات|فعالية|أنشطة|نشاط|events|activities/i.test(title)) return "activities";
  if (/مجالات|المجال|تقنيات|تخصصات|technology fields|domains/i.test(title)) return "fields";
  if (/مشاركة|عضوية|منافع|membership|participation/i.test(title)) return "membership";
  if (/برامج|برنامج|مسارات|مسار|ورش|معسكر|دورات|تعلم|مساهمة|ماذا نقدم|courses|programs|tracks|workshops|camps|learning|contribution/i.test(title)) return "programs";
  return "about";
}

function groupLabel(kind: OrganizationProfileGroupKind): string {
  switch (kind) {
    case "about": return "عن الجهة";
    case "programs": return "البرامج";
    case "structure": return "اللجان";
    case "activities": return "الفعاليات";
    case "fields": return "المجالات";
    case "partnerships": return "الشركاء";
    case "impact": return "الإنجازات";
    case "membership": return "العضوية";
  }
}

export const organizationTabOrder = ["about", "fields", "programs", "impact", "activities", "announcements", "membership", "applications", "partnerships", "structure"] as const;

export function orderOrganizationTabs<T extends { id: string }>(tabs: readonly T[]): T[] {
  const rank = (id: string) => organizationTabOrder.findIndex(key => key === id);
  return [...tabs].sort((a, b) => rank(a.id) - rank(b.id));
}

export function hasOrganizationSectionContent(section: OrganizationProfileSection): boolean {
  return Boolean(section.body?.trim() || section.image?.src.trim() || section.items?.some(item => (!section.highlightsOnly || item.highlighted) && (item.title.trim() || item.body?.trim())));
}

export function groupOrganizationProfileSections(
  sections: readonly OrganizationProfileSection[],
): OrganizationProfileGroup[] {
  const groups = new Map<string, OrganizationProfileGroup>();

  sections.forEach((section, index) => {
    if (!hasOrganizationSectionContent(section)) return;
    const kind = sectionGroupKind(section.title);
    if (!kind) return;
    const id = kind;
    const group = groups.get(id) ?? { id, kind, label: "", entries: [] };
    group.entries.push({ index, section });
    group.label = groupLabel(group.kind);
    groups.set(id, group);
  });

  return orderOrganizationTabs([...groups.values()]);
}
