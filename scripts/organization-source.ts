import { createOrganizationSchema, type CreateOrganizationInput } from "../src/features/organizations/validation";

const slugs: Record<string, string> = {
  "المجلس الطلابي": "student-council",
  "المجلس الاستشاري لعلوم الحاسب": "computer-science-advisory-council",
  "المجلس الاستشاري لتقنية المعلومات": "information-technology-advisory-council",
  "المجلس الاستشاري الطلابي لقسم تقنية المعلومات": "information-technology-student-advisory-council",
  "المجلس الاستشاري الطلابي لنظم المعلومات": "information-systems-student-advisory-council",
  "نادي تكنيشن": "technician-club",
  "نادي الإنجاز": "achievement-club",
  "نادي الأمن السيبراني": "cybersecurity-club",
  "نادي RobotX": "robotx-club",
  "نادي IEEE": "ieee-club",
  "نادي ظهير": "dhaheer-club",
  "نادي طويق": "tuwaiq-club",
  "مجتمع OSS": "oss-community",
};

export function parseOrganizationSource(markdown: string, requireComplete = true): CreateOrganizationInput[] {
  let typeCode: "Club" | "Council" | undefined;
  const organizations: CreateOrganizationInput[] = [];
  const seen = new Set<string>();
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();
    if (line.startsWith("## ")) {
      typeCode = line.includes("المجالس الطلابية") ? "Council" : line.includes("الأندية والمجتمعات الطلابية") ? "Club" : undefined;
      continue;
    }
    if (!line.startsWith("### ")) continue;
    const nameAr = line.replace(/^###\s+\S+\s+/, "").replace(/\s+_\(.+\)_$/, "").trim();
    const slug = slugs[nameAr];
    if (!slug) throw new Error(`Unknown organization: ${nameAr}`);
    if (!typeCode || (nameAr.startsWith("المجلس") !== (typeCode === "Council")) || seen.has(nameAr)) {
      throw new Error(`Invalid section or duplicate: ${nameAr}`);
    }
    seen.add(nameAr);
    const description: string[] = [];
    for (let next = index + 1; next < lines.length; next++) {
      const value = lines[next].trim();
      if (value.startsWith("|") || value.startsWith("---") || value.startsWith("#")) break;
      if (value) description.push(value);
    }
    if (!description.length) throw new Error(`Missing description: ${nameAr}`);
    organizations.push(createOrganizationSchema.parse({ nameAr, slug, typeCode, summary: description.join(" "), mission: "" }));
  }
  if (requireComplete && (organizations.length !== Object.keys(slugs).length || seen.size !== Object.keys(slugs).length)) {
    throw new Error(`Expected ${Object.keys(slugs).length} organizations; found ${organizations.length}.`);
  }
  return organizations;
}
