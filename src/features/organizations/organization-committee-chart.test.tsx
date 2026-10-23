// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/features/organizations/committee-dialog", () => ({
  CommitteeDialog: ({ open, parentCommitteeId }: { open: boolean; parentCommitteeId?: string }) => open ? <div role="dialog">تعديل اللجنة{parentCommitteeId && <span>{parentCommitteeId}</span>}</div> : null,
}));
vi.mock("@/features/organizations/committee-status-dialog", () => ({
  CommitteeStatusDialog: ({ open }: { open: boolean }) => open ? <div role="alertdialog">تأكيد أرشفة اللجنة</div> : null,
}));
vi.mock("@/features/organizations/mutation-form", () => ({ MutationForm: () => null }));
vi.mock("@/components/management-action-sheet", () => ({
  ManagementActionProvider: ({ children }: { children: ReactNode }) => children,
  ManagementActionSheet: ({ open, children }: { open: boolean; children: ReactNode }) => open ? <div role="dialog">{children}</div> : null,
}));

import { OrganizationCommitteeChart } from "./organization-committee-chart";

afterEach(cleanup);

it("offers edit, a preselected subcommittee parent and a destructive last delete action", async () => {
  render(<OrganizationCommitteeChart organizationId="org-1" organizationName="الجهة" committees={[committee("parent-a", "الفعاليات", null, true)]} canManage locale="ar" parentOptions={[{ id: "parent-a", name: "الفعاليات" }]} emptyMessage="لا توجد لجان" />);
  fireEvent.click(screen.getByRole("button", { name: "إجراءات الفعاليات" }));
  const menu = await screen.findByRole("menu");
  const items = menu.querySelectorAll('[role="menuitem"]');
  expect([...items].map(item => item.textContent)).toEqual(["تعديل", "إضافة لجنة فرعية", "حذف"]);
  expect(items[2].getAttribute("data-variant")).toBe("destructive");
  fireEvent.click(screen.getByRole("menuitem", { name: "إضافة لجنة فرعية" }));
  expect((await screen.findByRole("dialog")).textContent).toContain("parent-a");
});

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

it("renders the organization root and indented committee rows with collapsible branches", async () => {
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
  expect(screen.getByRole("list", { name: "هيكل اللجان" }).querySelectorAll(".management-committee-row")).toHaveLength(4);
  expect(document.querySelectorAll(".committee-branch-line")).toHaveLength(3);

  const first = screen.getByText("لجنة أ").closest(".management-committee-row") as HTMLElement;
  const second = screen.getByText("لجنة ب").closest(".management-committee-row") as HTMLElement;
  expect(first.style.position).toBe("");
  expect(second.style.position).toBe("");
  expect(first.closest(".management-committee-item")?.getAttribute("style")).toContain("--committee-depth: 1");
  fireEvent.click(screen.getByRole("button", { name: "طي لجنة أ" }));
  expect(screen.queryByText("فرعية ١")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "فتح لجنة أ" }));
  expect(screen.getByText("فرعية ١")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "إجراءات لجنة أ" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "تعديل" }));
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

it("lists twelve sibling committees as identically structured rows at the same depth", () => {
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

  const chart = screen.getByRole("list", { name: "هيكل اللجان" });
  const rows = [...chart.querySelectorAll(".management-committee-item")];
  expect(rows).toHaveLength(13);
  expect(rows.slice(1).every(row => row.querySelectorAll(":scope > .management-committee-row").length === 1)).toBe(true);
  expect(chart.querySelectorAll(".management-committee-row:not(.management-committee-row--organization)")).toHaveLength(12);
  expect(rows.slice(1).every(row => (row as HTMLElement).style.getPropertyValue("--committee-depth") === "1")).toBe(true);
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

  const root = screen.getByText("نادي الاختبار").closest(".management-committee-row--organization");
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
