import { expect, it } from "vitest";
import { buildCommitteeTree, separateLeadershipPositions } from "./committee-tree";

const committees = [
  { id: "root", name: "المجلس", parentCommitteeId: null },
  { id: "operations", name: "العمليات", parentCommitteeId: "root" },
  { id: "events", name: "الفعاليات", parentCommitteeId: "operations" },
  { id: "design", name: "التصميم", parentCommitteeId: "root" },
  { id: "orphan", name: "لجنة مستقلة", parentCommitteeId: "missing" },
];

it("builds nested committee branches and keeps orphaned parents visible", () => {
  const tree = buildCommitteeTree(committees);

  expect(tree.map(item => item.id)).toEqual(["root", "orphan"]);
  expect(tree[0].children.map(item => item.id)).toEqual(["design", "operations"]);
  expect(tree[0].children[1].children.map(item => item.id)).toEqual(["events"]);
});

it("breaks a corrupt cycle without hiding committees", () => {
  const tree = buildCommitteeTree([
    { id: "first", name: "الأولى", parentCommitteeId: "second" },
    { id: "second", name: "الثانية", parentCommitteeId: "first" },
  ]);

  expect(tree.flatMap(function flatten(item): string[] { return [item.id, ...item.children.flatMap(flatten)]; }).sort()).toEqual(["first", "second"]);
});

it("separates leadership roles from committee cards while keeping actual committees", () => {
  const { committees: visibleCommittees, leadershipPositions } = separateLeadershipPositions([
    { id: "president", name: "رئيسة المجتمع ومديرة العمليات", description: "قيادة المجتمع وإدارة عملياته." },
    { id: "planning", name: "إدارة التخطيط والتنفيذ", description: "تنظيم العمليات وتنفيذ المبادرات." },
    { id: "deputy", name: "نائب رئيس النادي", description: "مساندة رئيس النادي." },
  ]);

  expect(leadershipPositions.map(item => item.id)).toEqual(["president", "deputy"]);
  expect(visibleCommittees.map(item => item.id)).toEqual(["planning"]);
});
