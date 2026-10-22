// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { HoursData } from "@/features/hours/repository";
import { ActivityHours } from "./activity-views";

vi.mock("./activity-hour-filter", () => ({ ActivityHourFilter: () => <div data-testid="activity-hour-status-filters" /> }));
vi.mock("@/features/hours/form", () => ({ HoursForm: () => null }));
vi.mock("@/features/hours/view", () => ({
  HoursFields: () => null,
  TermSelect: () => <label>الفصل الأكاديمي<select name="term"><option value="">كل الفصول</option></select></label>,
  hourLabels: {},
  hourLabelsEn: {},
}));
vi.mock("@/features/events/view", () => ({ eventDate: () => "", eventLabels: {} }));
vi.mock("@/features/events/display", () => ({ eventDateEn: () => "", eventLabelsEn: {} }));
vi.mock("@/features/tasks/task-list", () => ({ TaskPagination: () => null }));

afterEach(cleanup);

const data: HoursData = {
  account: { status: "Active", onboarded: true },
  terms: [{ id: "term-1", name_ar: "الفصل الأول", academic_year: "2026", term_code: "1", start_date: "2026-08-01", end_date: "2026-12-31" }],
  records: [],
  total: "0",
  hoursByStatus: { approved: "0", pending: "0", rejected: "0" },
  byOrg: [],
  memberships: [],
};

it("uses the shared hours summary, an auto-filter select, and the shared empty state", () => {
  const { container } = render(<ActivityHours data={data} page={0} term={null} status="all" locale="ar" />);

  expect(screen.queryByText("سجل الساعات")).toBeNull();
  expect(screen.queryByRole("button", { name: "عرض الفترة" })).toBeNull();
  expect(container.querySelector('select[name="term"]')).toBeTruthy();
  expect(screen.getByTestId("activity-hour-status-filters")).toBeTruthy();
  expect(screen.getByText("الساعات المعتمدة")).toBeTruthy();
  expect(screen.getByText("بانتظار الاعتماد")).toBeTruthy();
  expect(screen.getByText("الساعات المرفوضة")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "لا توجد سجلات ساعات" })).toBeTruthy();
});
