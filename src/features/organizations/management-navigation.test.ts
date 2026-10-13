import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isSuperAdminUser: vi.fn(),
  getAdminAccountProfile: vi.fn(),
  getManagementOverview: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/features/auth/authorization", () => ({ isSuperAdminUser: mocks.isSuperAdminUser }));
vi.mock("./management-repository", () => ({
  getAdminAccountProfile: mocks.getAdminAccountProfile,
  getManagementOverview: mocks.getManagementOverview,
}));

import { hasSuperAdminNavigationAccess } from "./management-navigation";

beforeEach(() => vi.clearAllMocks());

describe("management navigation access", () => {
  it("uses the account profile authorization for account settings", async () => {
    mocks.getAdminAccountProfile.mockResolvedValue({ email: "admin@example.invalid", fullName: "مشرف" });

    await expect(hasSuperAdminNavigationAccess("account", "admin-id")).resolves.toBe(true);

    expect(mocks.getAdminAccountProfile).toHaveBeenCalledOnce();
    expect(mocks.getAdminAccountProfile).toHaveBeenCalledWith("admin-id");
    expect(mocks.isSuperAdminUser).not.toHaveBeenCalled();
  });

  it("does not grant account navigation when the profile query denies access", async () => {
    mocks.getAdminAccountProfile.mockRejectedValue(new Error("FORBIDDEN"));

    await expect(hasSuperAdminNavigationAccess("account", "user-id")).resolves.toBe(false);
    expect(mocks.isSuperAdminUser).not.toHaveBeenCalled();
  });

  it("keeps the fresh dashboard access check", async () => {
    mocks.getManagementOverview.mockResolvedValue({ access: { superAdmin: true } });

    await expect(hasSuperAdminNavigationAccess("dashboard", "admin-id", "nonce")).resolves.toBe(true);

    expect(mocks.getManagementOverview).toHaveBeenCalledWith("admin-id", "nonce");
  });
});
