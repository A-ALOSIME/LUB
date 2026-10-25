// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/features/organizations/committee-dialog", () => ({
  CommitteeDialog: ({ open }: { open: boolean }) => open ? <div role="dialog">تعديل اللجنة</div> : null,
}));
vi.mock("@/features/organizations/committee-status-dialog", () => ({
  CommitteeStatusDialog: ({ open }: { open: boolean }) => open ? <div role="alertdialog">تأكيد أرشفة اللجنة</div> : null,
}));
vi.mock("@/features/organizations/mutation-form", () => ({ MutationForm: () => null }));
vi.mock("@/components/management-action-sheet", () => ({
  ManagementActionSheet: ({ open, children }: { open: boolean; children: ReactNode }) => open ? <div role="dialog">{children}</div> : null,
}));

import { CommitteeListRow } from "./committee-list-row";

afterEach(cleanup);

const committee = { id: "committee-1", name: "لجنة الأمن", description: "", isPublic: true, statusCode: "Active", canEdit: true, memberCount: 0, leaderName: null };

it("opens committee editing from the row and shows management actions directly", () => {
  render(<ul><CommitteeListRow organizationId="org-1" committee={committee} canManage locale="ar" /></ul>);

  expect(screen.getByText("لا أعضاء")).toBeTruthy();
  expect(screen.getByText("بدون قائد")).toBeTruthy();
  expect(screen.getByText("عامة")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "تعديل لجنة الأمن" }));
  expect(screen.getByRole("dialog").textContent).toContain("تعديل اللجنة");
  fireEvent.click(screen.getByRole("button", { name: "تعديل اللجنة" }));
  expect(screen.getByRole("dialog").textContent).toContain("تعديل اللجنة");
  fireEvent.click(screen.getByRole("button", { name: "نسخ اللجنة" }));
  expect(screen.getByRole("dialog").textContent).toContain("سيُنشأ سجل لجنة جديد");
  fireEvent.click(screen.getByRole("button", { name: "أرشفة اللجنة" }));
  expect(screen.getByRole("alertdialog").textContent).toContain("تأكيد أرشفة اللجنة");
  expect(screen.queryByRole("menu")).toBeNull();
  expect(screen.getByRole("button", { name: "نسخ اللجنة" })).toBeTruthy();
});

it("keeps public chart cards name-only and opens full committee details on click", () => {
  render(<ul><CommitteeListRow
    organizationId="org-1"
    committee={{ ...committee, description: "تنسيق المبادرات والأنشطة التقنية بالكامل.", leaderName: "أحمد العتيبي", memberCount: 12 }}
    canManage={false}
    locale="ar"
    readOnly
  /></ul>);

  expect(screen.getByText("لجنة الأمن")).toBeTruthy();
  expect(screen.queryByText("تنسيق المبادرات والأنشطة التقنية بالكامل.")).toBeNull();
  expect(screen.queryByText("أحمد العتيبي")).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "عرض تفاصيل لجنة الأمن" }));

  const dialog = screen.getByRole("dialog");
  expect(dialog.textContent).toContain("لجنة الأمن");
  expect(dialog.textContent).toContain("تنسيق المبادرات والأنشطة التقنية بالكامل.");
  expect(dialog.textContent).toContain("أحمد العتيبي");
  expect(dialog.textContent).toContain("12 عضوًا");
});
