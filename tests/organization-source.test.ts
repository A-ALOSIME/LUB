import { describe, expect, it } from "vitest";
import { parseOrganizationSource } from "../scripts/organization-source";

describe("organization source import", () => {
  it("extracts only named clubs and councils with their supplied descriptions", () => {
    const source = `## 🏛️ المجالس الطلابية
### 📌 المجلس الطلابي
وصف المجلس.
| الدور | الاسم |
| الرئيس | فلان |
---
## 🎯 الأندية والمجتمعات الطلابية
### 🔧 نادي تكنيشن
وصف النادي.
| الدور | الاسم |
| القائد | فلان |`;
    expect(parseOrganizationSource(source, false)).toEqual([
      { nameAr: "المجلس الطلابي", slug: "student-council", typeCode: "Council", summary: "وصف المجلس.", mission: "" },
      { nameAr: "نادي تكنيشن", slug: "technician-club", typeCode: "Club", summary: "وصف النادي.", mission: "" },
    ]);
  });

  it("rejects unknown organizations instead of silently importing them", () => {
    expect(() => parseOrganizationSource("## 🎯 الأندية\n### 🔧 نادي مجهول\nوصف.", false)).toThrow(/Unknown organization/);
  });

  it("rejects a council placed under clubs", () => {
    expect(() => parseOrganizationSource("## 🎯 الأندية والمجتمعات الطلابية\n### 📌 المجلس الطلابي\nوصف.", false)).toThrow(/Invalid section/);
  });
});
