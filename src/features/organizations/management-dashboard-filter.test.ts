import { describe, expect, it } from "vitest";
import { filterManagedOrganizations, type ManagedOrganization } from "./management-dashboard-filter";

const organizations: ManagedOrganization[] = [
  { id: "1", nameAr: "نادي الأمن السيبراني", statusCode: "Active" },
  { id: "2", nameAr: "المجلس الطلابي", statusCode: "Active" },
  { id: "3", nameAr: "نادي الروبوتكس", statusCode: "Archived" },
];

describe("management dashboard filters", () => {
  it("searches by Arabic organization name without case-sensitive assumptions", () => {
    expect(filterManagedOrganizations(organizations, "السيبراني", "all").map(item => item.id)).toEqual(["1"]);
  });

  it("filters active and archived organizations separately", () => {
    expect(filterManagedOrganizations(organizations, "", "Active").map(item => item.id)).toEqual(["1", "2"]);
    expect(filterManagedOrganizations(organizations, "", "Archived").map(item => item.id)).toEqual(["3"]);
  });

  it("combines the search and status filters", () => {
    expect(filterManagedOrganizations(organizations, "نادي", "Active").map(item => item.id)).toEqual(["1"]);
  });
});
