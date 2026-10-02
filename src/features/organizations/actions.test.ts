import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ user: vi.fn(), status: vi.fn(), create: vi.fn(), save: vi.fn(), appoint: vi.fn(), lifecycle: vi.fn(), grant: vi.fn(), end: vi.fn(), committee: vi.fn(), copy: vi.fn(), committeeStatus: vi.fn(), announcement: vi.fn(), archiveAnnouncement: vi.fn(), revalidate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/features/auth/session", () => ({ requireUser: mocks.user }));
vi.mock("@/features/profile/repository", () => ({ getAccountStatus: mocks.status }));
vi.mock("./management-repository", () => ({ createOrganization: mocks.create, saveOrganizationProfile: mocks.save, appointPrimaryLeader: mocks.appoint, setOrganizationStatus: mocks.lifecycle, grantSuperAdmin: mocks.grant, endSuperAdmin: mocks.end, saveCommittee: mocks.committee, copyCommittee: mocks.copy, setCommitteeStatus: mocks.committeeStatus, saveAnnouncement: mocks.announcement, archiveAnnouncement: mocks.archiveAnnouncement }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate, updateTag: mocks.revalidate }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));
import { mutateOrganization } from "./actions";
const org = "00000000-0000-4000-8000-000000000101";
beforeEach(() => { vi.resetAllMocks(); mocks.user.mockResolvedValue({ id: "verified-user" }); mocks.status.mockResolvedValue("Active"); });
function form(values: Record<string, string>) { const data = new FormData(); for (const [key, value] of Object.entries(values)) data.set(key, value); return data; }
it("verifies the session before reading submitted operations", async () => {
  mocks.user.mockRejectedValue(new Error("REDIRECT:/login"));
  await expect(mutateOrganization({}, form({ operation: "org-status" }))).rejects.toThrow("REDIRECT:/login");
  expect(mocks.lifecycle).not.toHaveBeenCalled();
});
it("uses the verified actor and validated allowlisted fields, ignoring forged actor and lifecycle values", async () => {
  const state = await mutateOrganization({}, form({ operation: "org-profile", organizationId: org, userId: "forged", nameAr: "نادي التقنية", summary: "نبذة", mission: "", tagNames: "تقني", websiteUrl: "", statusCode: "Archived" }));
  expect(state.success).toBeDefined();
  expect(mocks.save).toHaveBeenCalledWith("verified-user", org, { nameAr: "نادي التقنية", summary: "نبذة", mission: "", tagNames: ["تقني"], websiteUrl: "", logoUrl: "", showLeadershipPublicly: false });
  expect(mocks.revalidate).toHaveBeenCalledWith("public-organizations");
});
it("requires explicit confirmation for primary appointment and archive changes", async () => {
  expect((await mutateOrganization({}, form({ operation: "appoint-leader", organizationId: org, email: "member@example.com" }))).error).toBeDefined();
  expect(mocks.appoint).not.toHaveBeenCalled();
  expect((await mutateOrganization({}, form({ operation: "org-status", organizationId: org, status: "Archived" }))).error).toBeDefined();
  expect(mocks.lifecycle).not.toHaveBeenCalled();
});
it("validates publication and pinning before saving an announcement as the verified actor", async () => {
  const invalid = await mutateOrganization({}, form({ operation: "save-announcement", organizationId: org, title: "إعلان", body: "نص عام", pinned: "on" }));
  expect(invalid.error).toBeDefined();
  expect(mocks.announcement).not.toHaveBeenCalled();
  const saved = await mutateOrganization({}, form({ operation: "save-announcement", organizationId: org, title: " إعلان ", body: " نص عام ", published: "on", pinned: "on", userId: "forged" }));
  expect(saved.success).toBeDefined();
  expect(mocks.announcement).toHaveBeenCalledWith("verified-user", org, { title: "إعلان", body: "نص عام", published: true, pinned: true }, undefined);
});
it("requires confirmation to archive an announcement", async () => {
  const announcementId = "00000000-0000-4000-8000-000000000202";
  expect((await mutateOrganization({}, form({ operation: "archive-announcement", organizationId: org, announcementId }))).error).toBeDefined();
  expect(mocks.archiveAnnouncement).not.toHaveBeenCalled();
  expect((await mutateOrganization({}, form({ operation: "archive-announcement", organizationId: org, announcementId, confirmed: "on" }))).success).toBeDefined();
  expect(mocks.archiveAnnouncement).toHaveBeenCalledWith("verified-user", org, announcementId);
});
it("fails closed for inactive accounts and does not echo external database details", async () => {
  mocks.status.mockResolvedValue("Inactive");
  expect((await mutateOrganization({}, form({ operation: "grant-admin", email: "member@example.com", confirmed: "on" }))).error).toBeDefined();
  expect(mocks.grant).not.toHaveBeenCalled();
  mocks.status.mockResolvedValue("Active"); mocks.grant.mockRejectedValue(new Error("postgres://private-password@db:5432/postgres"));
  const response = await mutateOrganization({}, form({ operation: "grant-admin", email: "member@example.com", confirmed: "on" }));
  expect(JSON.stringify(response)).not.toContain("private-password");
  expect(response.error).toBeDefined();
  expect(mocks.revalidate).not.toHaveBeenCalled();
});
