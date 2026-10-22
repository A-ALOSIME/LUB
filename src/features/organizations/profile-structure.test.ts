import { expect, it } from "vitest";
import { profileSectionsToCommitteeRoots } from "./profile-structure";

it("keeps each profile section as a root and nests only its own items", () => {
  const result = profileSectionsToCommitteeRoots([
    { index: 0, section: { title: "إدارة التقنية", items: [{ title: "لجنة البيانات" }, { title: "لجنة التطوير" }] } },
    { index: 1, section: { title: "إدارة الإعلام", items: [{ title: "لجنة التصميم" }] } },
  ]);

  expect(result.filter(item => item.parentCommitteeId === null).map(item => item.name)).toEqual([
    "إدارة التقنية",
    "إدارة الإعلام",
  ]);
  expect(result.filter(item => item.parentCommitteeId === "profile-section-0").map(item => item.name)).toEqual([
    "لجنة البيانات",
    "لجنة التطوير",
  ]);
  expect(result.filter(item => item.parentCommitteeId === "profile-section-1").map(item => item.name)).toEqual([
    "لجنة التصميم",
  ]);
});

it("keeps a section with no items as a compact root committee", () => {
  const result = profileSectionsToCommitteeRoots([{ index: 4, section: { title: "لجنة مستقلة", body: "تدعم أنشطة الجهة." } }]);

  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({ name: "لجنة مستقلة", description: "تدعم أنشطة الجهة.", parentCommitteeId: null });
});
