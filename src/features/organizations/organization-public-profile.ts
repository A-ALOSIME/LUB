import type { LocalOrganizationContent, OrganizationProfileSection } from "./local-content";

export type OrganizationPublicProfileContent = {
  vision?: string;
  values?: string;
  annualEventCount?: string;
  participatingStudentCount?: string;
  offerings?: string;
  goals?: string;
  fields?: string;
  programs?: string;
  achievements?: string;
  partners?: string;
  partnersImageUrl?: string;
};

export type OrganizationProfilePresentation = Pick<LocalOrganizationContent, "motto" | "vision" | "mission" | "stats" | "sections">;

const emptyContent: OrganizationPublicProfileContent = {};

export function normalizeOrganizationPublicProfileContent(value: unknown): OrganizationPublicProfileContent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return emptyContent;
  const source = value as Record<string, unknown>;
  const result: OrganizationPublicProfileContent = {};
  for (const key of ["vision", "values", "annualEventCount", "participatingStudentCount", "offerings", "goals", "fields", "programs", "achievements", "partners", "partnersImageUrl"] as const) {
    const field = source[key];
    if (typeof field === "string") result[key] = field.trim();
  }
  return result;
}

function entries(value?: string) {
  return value?.split(/\r?\n/).map(item => item.trim()).filter(Boolean).map(title => ({ title })) ?? [];
}

function withSection(sections: OrganizationProfileSection[], title: string, aliases: RegExp, value?: string, image?: OrganizationProfileSection["image"]) {
  const content = value?.trim();
  if (!content && !image) return sections;
  const retained = sections.filter(section => !aliases.test(section.title));
  return [...retained, {
    title,
    ...(content ? { items: entries(content) } : {}),
    ...(image ? { image } : {}),
  }];
}

function replaceStat(stats: Array<{ value: string; label: string }>, label: string, value?: string, pattern?: RegExp) {
  if (!value) return stats;
  const withoutPrevious = pattern ? stats.filter(stat => !pattern.test(stat.label)) : stats;
  return [...withoutPrevious, { value, label }];
}

export function buildOrganizationProfilePresentation({
  curated,
  saved,
  mission,
  memberCount,
}: {
  curated?: LocalOrganizationContent;
  saved?: unknown;
  mission: string | null | undefined;
  memberCount: number;
}): OrganizationProfilePresentation {
  const content = normalizeOrganizationPublicProfileContent(saved);
  let sections = [...(curated?.sections ?? [])];
  sections = withSection(sections, "قيمنا", /^(قيمنا|القيم|values)$/i, content.values);
  sections = withSection(sections, "ماذا نقدم؟", /^(ماذا نقدم؟|ماذا نقدم|ما نقدمه|offerings?)$/i, content.offerings);
  sections = withSection(sections, "أهداف النادي/المجلس", /^(أهداف النادي|أهداف المجلس|الأهداف|الأهداف السنوية|goals?)$/i, content.goals);
  sections = withSection(sections, "المجالات", /^(المجالات|مجالات العمل|المجالات التقنية|fields?|areas?)$/i, content.fields);
  sections = withSection(sections, "البرامج", /^(البرامج|برامج النادي|برامج المجلس|programs?)$/i, content.programs);
  sections = withSection(sections, "إنجازات النادي/المجلس", /^(إنجازات النادي|إنجازات المجلس|الإنجازات|أبرز الأعمال والإنجازات|achievements?)$/i, content.achievements);
  const partnerImage = content.partnersImageUrl && /^https:\/\//i.test(content.partnersImageUrl)
    ? { src: content.partnersImageUrl, alt: "صورة الشركاء", width: 1600, height: 900 }
    : undefined;
  sections = withSection(sections, "الشركاء", /^(الشركاء|الشراكات|partners?)$/i, content.partners, partnerImage);

  let stats = [...(curated?.stats ?? [])];
  stats = replaceStat(stats, "فعالية سنوية", content.annualEventCount, /فعالية|event/i);
  stats = replaceStat(stats, "طالب مشارك", content.participatingStudentCount, /طالب مشارك|participating students?/i);
  stats = replaceStat(stats, "عضو", String(Math.max(0, Math.trunc(memberCount))), /^(عضو|أعضاء|members?)$/i);

  return {
    motto: curated?.motto,
    vision: content.vision || curated?.vision,
    mission: mission?.trim() || curated?.mission,
    stats,
    sections,
  };
}
