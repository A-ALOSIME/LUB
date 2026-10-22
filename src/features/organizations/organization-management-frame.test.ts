import { describe, expect, it } from "vitest";
import { organizationManagementPage } from "./organization-management-frame";

describe("organization management page frame", () => {
  it("uses the same destination title for base and detail routes", () => {
    expect(organizationManagementPage("/manage/organizations/org-1", "ar").title).toBe("الجهة");
    expect(organizationManagementPage("/manage/organizations/org-1/events", "ar").title).toBe("الفعاليات والإعلانات");
    expect(organizationManagementPage("/manage/organizations/org-1/applications/application-1", "ar").title).toBe("الأعضاء");
  });

  it("keeps the organization name out of the page heading and localizes labels", () => {
    const page = organizationManagementPage("/manage/organizations/org-1/permissions", "en");
    expect(page).toEqual({ title: "Members" });
    expect(JSON.stringify(page)).not.toContain("org-1");
  });
});
