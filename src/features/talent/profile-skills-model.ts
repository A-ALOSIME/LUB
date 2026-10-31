import type { Locale } from "@/lib/preferences";
export type ProfileSkill = {
  key: string;
  labelAr: string;
  labelEn: string;
  category: { key: string; labelAr: string; labelEn: string };
  featured: boolean;
  order: number;
  tasks: number;
  events: number;
  filterValue: string;
};
export const skillName = (skill: ProfileSkill, locale: Locale) =>
  locale === "en" ? skill.labelEn : skill.labelAr;
export function orderProfileSkills(skills: ProfileSkill[], locale: Locale) {
  const explicit = skills.some((s) => s.featured);
  return [...skills].sort((a, b) =>
    explicit
      ? Number(b.featured) - Number(a.featured) || a.order - b.order
      : b.tasks - a.tasks ||
        skillName(a, locale).localeCompare(skillName(b, locale), locale),
  );
}
export function legacyProfileSkills(names: string[]): ProfileSkill[] {
  return names.map((name, order) => ({
    key: name,
    labelAr: name,
    labelEn: name,
    filterValue: name,
    category: { key: "other", labelAr: "أخرى", labelEn: "Other" },
    featured: false,
    order,
    tasks: 0,
    events: 0,
  }));
}
