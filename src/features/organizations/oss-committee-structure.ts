type CommitteeRecord = {
  id: string;
  name: string;
  description: string;
  parentCommitteeId: string | null;
};

type NamedBranch = {
  name: string;
  aliases: readonly string[];
};

type DepartmentBranch = NamedBranch & {
  children: readonly NamedBranch[];
};

const departments: readonly DepartmentBranch[] = [
  {
    name: "إدارة الابتكار التقني",
    aliases: ["إدارة الابتكار التقني", "الابتكار التقني"],
    children: [
      { name: "لجنة الذكاء الاصطناعي", aliases: ["لجنة الذكاء الاصطناعي", "الذكاء الاصطناعي"] },
      { name: "لجنة التطوير", aliases: ["لجنة التطوير", "التطوير"] },
    ],
  },
  { name: "مبادرة تقدم الأعضاء", aliases: ["مبادرة تقدم الأعضاء", "تطوير الأعضاء"], children: [] },
  { name: "إدارة العلاقات العامة", aliases: ["إدارة العلاقات العامة", "العلاقات العامة"], children: [] },
  {
    name: "إدارة التخطيط والتنفيذ",
    aliases: ["إدارة التخطيط والتنفيذ", "التخطيط والتنفيذ"],
    children: [
      { name: "لجنة الرؤية والتخطيط", aliases: ["لجنة الرؤية والتخطيط", "الرؤية والتخطيط"] },
      { name: "لجنة التنفيذ اللوجيستي", aliases: ["لجنة التنفيذ اللوجيستي", "لجنة التنفيذ اللوجستي", "التنفيذ اللوجيستي", "التنفيذ اللوجستي"] },
    ],
  },
  {
    name: "إدارة الموارد البشرية",
    aliases: ["إدارة الموارد البشرية", "الموارد البشرية"],
    children: [
      { name: "لجنة إدارة الأعضاء", aliases: ["لجنة إدارة الأعضاء", "إدارة الأعضاء"] },
      { name: "لجنة الجودة والتطوير", aliases: ["لجنة الجودة والتطوير", "الجودة والتطوير"] },
    ],
  },
  {
    name: "إدارة الإعلام والتصميم",
    aliases: ["إدارة الإعلام والتصميم", "الإعلام والتصميم"],
    children: [
      { name: "لجنة تصميم الجرافيك", aliases: ["لجنة تصميم الجرافيك", "تصميم الجرافيك"] },
      { name: "لجنة الإعلام والتسويق", aliases: ["لجنة الإعلام والتسويق", "الإعلام والتسويق"] },
    ],
  },
];

function normalizeName(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/\s+/g, " ")
    .trim();
}

function markMatchingRecords<T extends CommitteeRecord>(records: readonly T[], aliases: readonly string[], usedIds: Set<string>): T | undefined {
  const normalizedAliases = new Set(aliases.map(normalizeName));
  let selected: T | undefined;
  for (const record of records) {
    if (!normalizedAliases.has(normalizeName(record.name))) continue;
    usedIds.add(record.id);
    selected ??= record;
  }
  return selected;
}

/**
 * Curated OSS content stores each department and its subcommittees as one flat
 * item. Rebuild the public chart hierarchy here without changing saved data.
 */
export function buildOssCommitteeHierarchy<T extends CommitteeRecord>(
  records: readonly T[],
  curatedDepartments: readonly T[],
  createChild: (parent: T, id: string, name: string) => T,
): T[] {
  const usedRecordIds = new Set<string>();
  const usedCuratedIds = new Set<string>();
  const result: T[] = [];

  for (const [departmentIndex, department] of departments.entries()) {
    const storedDepartment = markMatchingRecords(records, department.aliases, usedRecordIds);
    const curatedDepartment = markMatchingRecords(curatedDepartments, department.aliases, usedCuratedIds);
    const template = storedDepartment ?? curatedDepartment;
    if (!template) continue;

    const parent = {
      ...template,
      name: department.name,
      description: curatedDepartment?.description.trim() || template.description,
      parentCommitteeId: null,
    } as T;
    result.push(parent);

    for (const [childIndex, child] of department.children.entries()) {
      const storedChild = markMatchingRecords(records, child.aliases, usedRecordIds);
      markMatchingRecords(curatedDepartments, child.aliases, usedCuratedIds);
      const childRecord = storedChild
        ? { ...storedChild, name: child.name, parentCommitteeId: parent.id }
        : { ...createChild(parent, `oss-curated-${departmentIndex + 1}-${childIndex + 1}`, child.name), name: child.name, parentCommitteeId: parent.id };
      result.push(childRecord as T);
    }
  }

  for (const record of records) {
    if (!usedRecordIds.has(record.id)) result.push({ ...record, parentCommitteeId: null });
  }

  return result;
}
