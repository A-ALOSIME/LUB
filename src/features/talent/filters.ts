import { skillKey } from "./skill-normalization";
export type TalentFilters = {
  q: string;
  skills: string[];
  major: string;
  level: string;
  minHours: number;
  sort: "relevance" | "hours" | "name";
  page: number;
};
export type TalentQuery = Record<string, string | string[] | undefined>;
export function parseTalentFilters(query: TalentQuery): TalentFilters {
  const one = (key: string) => {
    const value = query[key];
    return (Array.isArray(value) ? value[0] : value) ?? "";
  };
  const skills = query.skill ?? query.skills ?? [];
  return {
    q: one("q").trim().slice(0, 120),
    skills: [
      ...new Set(
        (Array.isArray(skills) ? skills : [skills])
          .filter(Boolean)
          .slice(0, 20)
          .map((x) => skillKey(x.slice(0, 80))),
      ),
    ],
    major: one("major").slice(0, 120),
    level: /^(?:[1-9]|1[0-2]|graduate)$/.test(one("level")) ? one("level") : "",
    minHours: Math.min(
      100000,
      Math.max(0, Math.floor(Number(one("minHours")) || 0)),
    ),
    sort:
      one("sort") === "hours"
        ? "hours"
        : one("sort") === "name"
          ? "name"
          : "relevance",
    page: Math.min(10000, Math.max(0, Math.floor(Number(one("page")) || 0))),
  };
}
export function talentQuery(filters: TalentFilters) {
  const q = new URLSearchParams();
  if (filters.q) q.set("q", filters.q);
  filters.skills.forEach((skill) => q.append("skill", skill));
  if (filters.major) q.set("major", filters.major);
  if (filters.level) q.set("level", filters.level);
  if (filters.minHours) q.set("minHours", String(filters.minHours));
  if (filters.sort !== "relevance") q.set("sort", filters.sort);
  if (filters.page) q.set("page", String(filters.page));
  return q.toString();
}
export function talentHref(filters: TalentFilters) {
  const query = talentQuery(filters);
  return `/talent${query ? `?${query}` : ""}`;
}
export function talentReturnPath(value: string | undefined) {
  try {
    const url = new URL(value ?? "/talent", "https://lub.community");
    if (url.origin !== "https://lub.community" || url.pathname !== "/talent")
      return "/talent";
    const query: TalentQuery = {};
    for (const key of url.searchParams.keys())
      query[key] = url.searchParams.getAll(key);
    return talentHref(parseTalentFilters(query));
  } catch {
    return "/talent";
  }
}
