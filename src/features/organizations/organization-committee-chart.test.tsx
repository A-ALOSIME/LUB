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

import { OrganizationCommitteeChart } from "./organization-committee-chart";

afterEach(cleanup);

type TestCommittee = {
  id: string;
  name: string;
  description: string;
  isPublic: boolean;
  statusCode: string;
  copiedFromCommitteeId: null;
  parentCommitteeId: string | null;
  canEdit: boolean;
  memberCount: number;
  leaderName: null;
  children: TestCommittee[];
};

const committee = (id: string, name: string, parentCommitteeId: string | null, canEdit = false, children: TestCommittee[] = []): TestCommittee => ({
  id,
  name,
  description: "",
  isPublic: true,
  statusCode: "Active",
  copiedFromCommitteeId: null,
  parentCommitteeId,
  canEdit,
  memberCount: 0,
  leaderName: null,
  children,
});

it("renders the organization root, sibling committees, and nested branches as a chart", () => {
  render(<OrganizationCommitteeChart
    organizationId="org-1"
    organizationName="نادي الاختبار"
    committees={[
      committee("a", "لجنة أ", null, true, [committee("a-1", "فرعية ١", "a")]),
      committee("b", "لجنة ب", null),
    ]}
    canManage={false}
    locale="ar"
    parentOptions={[]}
    emptyMessage="ما فيه لجان مسجلة حتى الآن."
  />);

  expect(screen.getByText("نادي الاختبار")).toBeTruthy();
  expect(screen.getByRole("list", { name: "الهيكل التنظيمي للجان" }).querySelectorAll(".organization-committee-node")).toHaveLength(3);
  expect(document.querySelectorAll(".organization-org-chart-row")).toHaveLength(2);

  const first = screen.getByText("لجنة أ").closest(".organization-committee-node") as HTMLElement;
  const second = screen.getByText("لجنة ب").closest(".organization-committee-node") as HTMLElement;
  expect(first.style.position).toBe("");
  expect(second.style.position).toBe("");
  expect(first.closest(".organization-org-chart-row")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "تعديل لجنة أ" }));
  expect(screen.getByRole("dialog").textContent).toContain("تعديل اللجنة");
});

it("shows the organization root with a compact empty state when there are no committees", () => {
  render(<OrganizationCommitteeChart
    organizationId="org-1"
    organizationName="نادي الاختبار"
    committees={[]}
    canManage={false}
    locale="ar"
    parentOptions={[]}
    emptyMessage="ما فيه لجان مسجلة حتى الآن."
  />);

  expect(screen.getByText("نادي الاختبار")).toBeTruthy();
  expect(screen.getByRole("status").textContent).toContain("ما فيه لجان مسجلة حتى الآن.");
  expect(document.querySelector(".organization-org-chart-row")).toBeNull();
});

it("keeps direct public committees as compact sibling leaves", () => {
  render(<OrganizationCommitteeChart
    organizationId="org-1"
    organizationName="المجلس الاستشاري"
    committees={[committee("a", "لجنة أ", null), committee("b", "لجنة ب", null)]}
    canManage={false}
    readOnly
    locale="ar"
    parentOptions={[]}
    emptyMessage="ما فيه لجان مسجلة حتى الآن."
  />);

  const row = document.querySelector(".organization-org-chart-row--direct");
  expect(row).toBeTruthy();
  expect(row?.querySelectorAll(":scope > .organization-committee-row--leaf")).toHaveLength(2);
  expect(row?.querySelectorAll(":scope > .organization-committee-row--department")).toHaveLength(0);
  expect(document.querySelectorAll(".organization-org-chart-children--branch")).toHaveLength(0);
});

it("wraps twelve sibling committees into rows of at most four without fixed horizontal positions", () => {
  const committees = Array.from({ length: 12 }, (_, index) => committee(`committee-${index + 1}`, `لجنة ${index + 1}`, null));
  render(<OrganizationCommitteeChart
    organizationId="org-1"
    organizationName="نادي طويق"
    committees={committees}
    canManage={false}
    locale="ar"
    parentOptions={[]}
    emptyMessage="ما فيه لجان مسجلة حتى الآن."
  />);

  const chart = screen.getByRole("list", { name: "الهيكل التنظيمي للجان" });
  const rows = [...chart.querySelectorAll(".organization-org-chart-row")];
  expect(rows).toHaveLength(3);
  expect(rows.every(row => row.querySelectorAll(":scope > .organization-committee-row").length <= 4)).toBe(true);
  expect(chart.querySelectorAll(".organization-committee-node")).toHaveLength(12);
  expect(chart.querySelectorAll(".organization-committee-node[style]")).toHaveLength(0);
});

it("shows leadership inside the organization root instead of a separate card", () => {
  render(<OrganizationCommitteeChart
    organizationId="org-1"
    organizationName="نادي الاختبار"
    rootDetails={["القائد: أحمد"]}
    committees={[]}
    canManage={false}
    locale="ar"
    parentOptions={[]}
    emptyMessage="ما فيه لجان مسجلة حتى الآن."
  />);

  const root = screen.getByText("نادي الاختبار").closest(".organization-org-chart-root");
  expect(root?.textContent).toContain("القائد: أحمد");
});

it("renders a public chart as read-only even when committee data has management permissions", () => {
  render(<OrganizationCommitteeChart
    organizationId="org-1"
    organizationName="نادي الاختبار"
    committees={[{
      ...committee("a", "لجنة أ", null, true, [committee("a-child", "لجنة فرعية", "a")]),
      description: "تنظيم المبادرات والأنشطة التقنية.",
      memberCount: 12,
      leaderName: "أحمد العتيبي",
    }]}
    canManage
    readOnly
    locale="ar"
    parentOptions={[]}
    emptyMessage="ما فيه لجان مسجلة حتى الآن."
  />);

  const chart = screen.getByRole("list", { name: "الهيكل التنظيمي للجان" });
  expect(chart.querySelectorAll(".organization-committee-node")).toHaveLength(2);
  expect(chart.closest(".organization-org-chart-viewport")?.classList.contains("organization-org-chart-viewport--public")).toBe(true);
  expect(chart.querySelector(".organization-org-chart-children--root")).toBeTruthy();
  expect(chart.querySelector(".organization-org-chart-children--branch")).toBeTruthy();
  expect(chart.querySelector(".organization-org-chart-row--root")).toBeTruthy();
  expect(chart.querySelector(".organization-org-chart-row--branch")).toBeTruthy();
  expect(chart.querySelectorAll("button")).toHaveLength(2);
  expect(screen.queryByText("تنظيم المبادرات والأنشطة التقنية.")).toBeNull();
  expect(screen.queryByText("أحمد العتيبي")).toBeNull();
  expect(screen.queryByText("12 أعضاء")).toBeNull();
  expect(screen.queryByText("عامة")).toBeNull();
  expect(chart.querySelector(".organization-committee-meta")).toBeNull();
  expect(chart.querySelector(".organization-status-badge")).toBeNull();
  expect(screen.queryByRole("dialog")).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "عرض تفاصيل لجنة أ" }));
  const dialog = screen.getByRole("dialog");
  expect(dialog.textContent).toContain("لجنة أ");
  expect(dialog.textContent).toContain("تنظيم المبادرات والأنشطة التقنية.");
  expect(dialog.textContent).toContain("أحمد العتيبي");
  expect(dialog.textContent).toContain("12 أعضاء");
});

it("keeps public departments in one balanced row and nests each committee inside its own department", () => {
  const departments = Array.from({ length: 6 }, (_, departmentIndex) => committee(
    `department-${departmentIndex + 1}`,
    `إدارة ${departmentIndex + 1}`,
    null,
    false,
    [
      committee(`department-${departmentIndex + 1}-a`, `لجنة ${departmentIndex + 1} أ`, `department-${departmentIndex + 1}`),
      committee(`department-${departmentIndex + 1}-b`, `لجنة ${departmentIndex + 1} ب`, `department-${departmentIndex + 1}`),
    ],
  ));

  render(<OrganizationCommitteeChart
    organizationId="org-1"
    organizationName="مجتمع الاختبار"
    committees={departments}
    canManage={false}
    readOnly
    locale="ar"
    parentOptions={[]}
    emptyMessage="ما فيه لجان مسجلة حتى الآن."
  />);

  const chart = screen.getByRole("list", { name: "الهيكل التنظيمي للجان" });
  const departmentColumns = [...chart.querySelectorAll(":scope > .organization-org-chart-root-row > .organization-org-chart-children--root > .organization-org-chart-row--root > .organization-committee-row--department")];
  expect(chart.querySelectorAll(":scope > .organization-org-chart-root-row > .organization-org-chart-children--root > .organization-org-chart-row--root")).toHaveLength(1);
  expect(departmentColumns).toHaveLength(6);

  for (const [index, department] of departmentColumns.entries()) {
    const name = `إدارة ${index + 1}`;
    expect(department.querySelector(".organization-committee-name")?.textContent).toBe(name);
    expect(department.querySelectorAll(":scope > .organization-org-chart-children--branch .organization-committee-row--branch")).toHaveLength(2);
  }
});
