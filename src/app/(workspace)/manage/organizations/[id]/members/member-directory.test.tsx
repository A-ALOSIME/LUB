// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { OrganizationMemberWorkspace } from "@/features/organizations/management-repository";
import { MemberDirectory } from "./member-directory";

vi.mock("next/navigation",()=>({useRouter:()=>({refresh:vi.fn()})}));
vi.mock("@/features/hours/view", () => ({ HoursFields: () => null }));
vi.mock("@/features/hours/form", () => ({ HoursForm: () => null }));
vi.mock("@/features/forms/mutation-form", () => ({ WorkflowForm: () => null }));
vi.mock("@/features/organizations/members-actions", () => ({ mutateOrganizationMembers: vi.fn() }));
vi.mock("@/features/forms/date-input", () => ({ DateInput: () => null }));
vi.mock("../permissions/permission-editor", () => ({ permissionLabels: {}, scopedPermissions: new Set() }));

afterEach(cleanup);

const workspace: OrganizationMemberWorkspace = {
  canManage: false,
  canGrant: false,
  canAddHours: false,
  terms: [],
  committees: [],
  members: [
    { id: "member-active", name: "أحمد محمد", major: "نظم معلومات", level: "السادس", status: "Active", startDate: "2026-10-12", endDate: null, canManage: false, hours: 7, roles: [], committees: [], hourScopes: [] },
    { id: "member-ended", name: "سارة علي", major: "أمن سيبراني", level: "الثامن", status: "Ended", startDate: "2025-10-12", endDate: "2026-10-01", canManage: false, hours: 0, roles: [], committees: [], hourScopes: [] },
  ],
};

it("uses a compact unlabeled search and filters members by status", () => {
  render(<MemberDirectory organization="org" workspace={workspace} locale="ar" />);

  expect(screen.queryByText("بحث في الأعضاء")).toBeNull();
  expect(screen.queryByText("2 / 2")).toBeNull();
  expect(screen.getByPlaceholderText("الاسم أو التخصص أو اللجنة")).toBeTruthy();
  expect(document.querySelector("[data-slot=avatar],img")).toBeNull();
  const search = screen.getByRole("searchbox", { name: "بحث الأعضاء" });
  expect(search.getAttribute("dir")).toBe("rtl");
  expect(search.closest('[data-slot="input-group"]')?.querySelector('[data-slot="input-group-addon"]')).toBeTruthy();
  expect(document.querySelector('.member-directory-search-wrap [data-slot="input-group-addon"] svg')).toBeTruthy();
  expect(document.querySelector('.member-directory-search-wrap [data-slot="input-group-addon"]')?.className).not.toContain("absolute");
  expect(screen.getAllByText("أحمد محمد").length).toBeGreaterThan(0);
  expect(screen.getAllByText("سارة علي").length).toBeGreaterThan(0);
  expect(screen.getAllByText("منذ ١٢ أكتوبر ٢٠٢٦")).toHaveLength(2);

  fireEvent.click(screen.getByRole("tab", { name: "منتهية" }));

  expect(screen.queryAllByText("أحمد محمد")).toHaveLength(0);
  expect(screen.getAllByText("سارة علي").length).toBeGreaterThan(0);
});

it("shows named member actions in place and keeps membership ending last", () => {
  const actionableWorkspace: OrganizationMemberWorkspace = {
    ...workspace,
    canGrant: true,
    canAddHours: true,
    members: [{ ...workspace.members[0], canManage: true }],
  };
  render(<MemberDirectory organization="org" workspace={actionableWorkspace} locale="ar" />);

  expect(screen.queryByRole("button", { name: "إجراءات أحمد محمد" })).toBeNull();
  expect(screen.queryByRole("menuitem")).toBeNull();
  expect(screen.getAllByRole("button", { name: "منح صلاحية" })).toHaveLength(2);
  expect(screen.getAllByRole("button", { name: "إضافة ساعات" })).toHaveLength(2);
  expect(screen.getAllByRole("button", { name: "نقل إلى لجنة" })).toHaveLength(2);
  expect(screen.getAllByRole("button", { name: "إنهاء العضوية" })).toHaveLength(2);

  const actionRows = document.querySelectorAll(".member-directory-actions");
  expect(actionRows).toHaveLength(2);
  expect(actionRows[0].textContent).toContain("منح صلاحية");
  expect(actionRows[0].textContent).toContain("إضافة ساعات");
  expect(actionRows[0].textContent?.indexOf("إنهاء العضوية")).toBeGreaterThan(actionRows[0].textContent?.indexOf("إضافة ساعات") ?? -1);
  expect(document.querySelectorAll(".member-directory-actions--mobile .member-directory-action--end")).toHaveLength(1);

  fireEvent.click(screen.getAllByRole("button", { name: "إنهاء العضوية" })[0]);
  expect(screen.getByRole("heading", { name: "إنهاء عضوية أحمد محمد؟" })).toBeTruthy();
  expect(screen.getByRole("alertdialog")).toBeTruthy();
});

it("keeps all action positions visible for every member and disables unavailable actions", () => {
  render(<MemberDirectory organization="org" workspace={workspace} locale="ar" />);

  const actionRows = document.querySelectorAll(".member-directory-actions");
  expect(actionRows).toHaveLength(workspace.members.length * 2);
  for (const row of actionRows) {
    expect(row.querySelectorAll('[data-slot="button"]')).toHaveLength(4);
    expect(row.textContent).toContain("منح صلاحية");
    expect(row.textContent).toContain("إضافة ساعات");
    expect(row.textContent).toContain("إنهاء العضوية");
  }
  expect(document.querySelectorAll(".member-directory-actions--mobile .member-directory-action--end")).toHaveLength(workspace.members.length);
});
