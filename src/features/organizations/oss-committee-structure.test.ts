import { expect, it } from "vitest";
import { buildOssCommitteeHierarchy } from "./oss-committee-structure";

type Committee = {
  id: string;
  name: string;
  description: string;
  parentCommitteeId: string | null;
};

const committee = (id: string, name: string, description = ""): Committee => ({ id, name, description, parentCommitteeId: null });

const departments = [
  committee("innovation", "إدارة الابتكار التقني", "تنمية التقنية."),
  committee("members", "مبادرة تقدم الأعضاء", "تمكين الأعضاء."),
  committee("public-relations", "إدارة العلاقات العامة", "بناء الشراكات."),
  committee("planning", "إدارة التخطيط والتنفيذ", "تنظيم المبادرات."),
  committee("hr", "إدارة الموارد البشرية", "إدارة شؤون الأعضاء."),
  committee("media", "إدارة الإعلام والتصميم", "إدارة الإعلام."),
];

it("builds six OSS department roots with their eight named committee children", () => {
  const tree = buildOssCommitteeHierarchy([], departments, (parent, id, name) => ({
    id,
    name,
    description: "",
    parentCommitteeId: parent.id,
  }));

  expect(tree.filter(item => item.parentCommitteeId === null).map(item => item.name)).toEqual([
    "إدارة الابتكار التقني",
    "مبادرة تقدم الأعضاء",
    "إدارة العلاقات العامة",
    "إدارة التخطيط والتنفيذ",
    "إدارة الموارد البشرية",
    "إدارة الإعلام والتصميم",
  ]);
  expect(tree.filter(item => item.parentCommitteeId).map(item => item.name)).toEqual([
    "لجنة الذكاء الاصطناعي",
    "لجنة التطوير",
    "لجنة الرؤية والتخطيط",
    "لجنة التنفيذ اللوجيستي",
    "لجنة إدارة الأعضاء",
    "لجنة الجودة والتطوير",
    "لجنة تصميم الجرافيك",
    "لجنة الإعلام والتسويق",
  ]);
  expect(tree.filter(item => item.parentCommitteeId)).toHaveLength(8);
});

it("reuses existing OSS committees, attaches them to the named parent, and keeps unknown records", () => {
  const existingChild = committee("stored-ai", "لجنة الذكاء الاصطناعي", "تطوير حلول ذكية.");
  const extra = committee("extra", "لجنة المبادرات", "مبادرات المجتمع.");
  const tree = buildOssCommitteeHierarchy([existingChild, extra], departments, (parent, id, name) => ({
    id,
    name,
    description: "",
    parentCommitteeId: parent.id,
  }));

  expect(tree.find(item => item.id === "stored-ai")?.parentCommitteeId).toBe("innovation");
  expect(tree.find(item => item.id === "stored-ai")?.description).toBe("تطوير حلول ذكية.");
  expect(tree.find(item => item.id === "extra")).toMatchObject({ parentCommitteeId: null, name: "لجنة المبادرات" });
  expect(tree.filter(item => item.name === "لجنة الذكاء الاصطناعي")).toHaveLength(1);
});

it("accepts existing department aliases without duplicating their curated fallback", () => {
  const existing = committee("stored-innovation", "الابتكار التقني", "وصف محفوظ.");
  const tree = buildOssCommitteeHierarchy([existing], departments, (parent, id, name) => ({
    id,
    name,
    description: "",
    parentCommitteeId: parent.id,
  }));

  expect(tree.filter(item => item.name === "إدارة الابتكار التقني")).toHaveLength(1);
  expect(tree[0]).toMatchObject({ id: "stored-innovation", parentCommitteeId: null });
});
