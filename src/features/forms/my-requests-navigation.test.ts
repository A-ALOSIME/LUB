import { describe, expect, it } from "vitest";
import { legacyRenewalsHref, resolveRequestsTab } from "./my-requests-navigation";

describe("my requests navigation", () => {
  it("opens renewals from the explicit tab and defaults all other values to applications", () => {
    expect(resolveRequestsTab("renewals")).toBe("renewals");
    expect(resolveRequestsTab("applications")).toBe("applications");
    expect(resolveRequestsTab(undefined)).toBe("applications");
    expect(resolveRequestsTab("unknown")).toBe("applications");
  });

  it("preserves a legacy renewals page number while routing to the merged page", () => {
    expect(legacyRenewalsHref(undefined)).toBe("/applications?tab=renewals");
    expect(legacyRenewalsHref("3")).toBe("/applications?tab=renewals&page=3");
    expect(legacyRenewalsHref(["4", "5"])).toBe("/applications?tab=renewals&page=4");
  });
});
