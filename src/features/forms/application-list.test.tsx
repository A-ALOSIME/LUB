// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { previewApplications } from "./application-preview";
import { ApplicationList } from "./application-list";
import { countApplicationStatuses } from "./application-status";
import { ApplicationStatusFilters } from "./application-status-filters";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => <a href={href} {...props}>{children}</a>,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("./application-row-actions", () => ({
  ApplicationRowActions: ({ preview }: { preview: boolean }) => <button type="button" aria-label="إجراءات الطلب" disabled={preview}>•••</button>,
}));

afterEach(cleanup);

it("renders a status-filtered shadcn table with counts and mobile cards in the preview", () => {
  render(<ApplicationList
    rows={previewApplications}
    counts={countApplicationStatuses(previewApplications)}
    locale="ar"
    preview
    status="all"
  />);

  expect(screen.getByRole("note").textContent).toContain("بيانات تجريبية");
  expect(screen.getByRole("table")).toBeTruthy();
  expect(screen.getAllByRole("columnheader").map(header => header.textContent)).toEqual([
    "الجهة",
    "تاريخ التقديم",
    "الحالة",
    "إجراءات",
  ]);
  expect(screen.getByRole("button", { name: /الكل/ }).textContent).toContain("5");
  expect(screen.getByRole("button", { name: /قيد المراجعة/ }).textContent).toContain("2");
  expect(screen.getByRole("button", { name: /مقبول/ }).textContent).toContain("1");
  expect(screen.getByRole("button", { name: /مرفوض/ }).textContent).toContain("1");
  expect(screen.getByRole("button", { name: /مسحوب/ }).textContent).toContain("1");
  expect(screen.getByRole("button", { name: /الكل/ }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("group", { name: "تصفية الطلبات حسب الحالة" }).getAttribute("dir")).toBe("rtl");
  expect(screen.getByRole("group", { name: "تصفية الطلبات حسب الحالة" }).getAttribute("data-size")).toBe("sm");
  expect(screen.getAllByRole("row")[0].className).toContain("border-border/60");
  expect(screen.getAllByRole("button", { name: "إجراءات الطلب" }).every(button => button.hasAttribute("disabled"))).toBe(true);
  expect(screen.queryByText("المراجع")).toBeNull();
  expect(screen.queryByText("السحب والإفلات")).toBeNull();
});

it("changes request filters through the URL without the underline tab treatment", () => {
  render(<ApplicationList
    rows={previewApplications}
    counts={countApplicationStatuses(previewApplications)}
    locale="ar"
    preview
    status="all"
  />);

  fireEvent.click(screen.getByRole("button", { name: /قيد المراجعة/ }));
  expect(push).toHaveBeenCalledWith("/applications?tab=applications&preview=1&status=review");
});

it("shows one first-time call to action in the empty state", () => {
  render(<ApplicationList
    rows={[]}
    counts={countApplicationStatuses([])}
    locale="ar"
    status="all"
  />);

  expect(screen.getAllByText("ما قدمت على أي جهة حتى الآن.")).toHaveLength(1);
  expect(screen.getAllByRole("link", { name: "تقديم طلب جديد" })).toHaveLength(1);
  expect(screen.queryByRole("table")).toBeNull();
  expect(screen.queryByRole("columnheader")).toBeNull();
  expect(screen.queryByRole("group", { name: "تصفية الطلبات حسب الحالة" })).toBeNull();
  expect(screen.queryByRole("link", { name: "استكشف الجهات" })).toBeNull();
});

it("hides zero counts from application status filters", () => {
  render(<ApplicationStatusFilters
    status="all"
    counts={{ all: 2, review: 2, accepted: 0, rejected: 0, withdrawn: 0 }}
    preview={false}
    locale="ar"
  />);

  expect(screen.getByRole("button", { name: /الكل/ }).textContent).toContain("2");
  expect(screen.getByRole("button", { name: "مقبول" }).textContent).toBe("مقبول");
  expect(screen.getByRole("button", { name: "مرفوض" }).textContent).toBe("مرفوض");
  expect(screen.getByRole("button", { name: "مسحوب" }).textContent).toBe("مسحوب");
});

it("shows one new application action above the list when applications exist", () => {
  render(<ApplicationList
    rows={previewApplications}
    counts={countApplicationStatuses(previewApplications)}
    locale="ar"
    preview
    status="all"
  />);
  expect(screen.getAllByRole("link", { name: "تقديم طلب جديد" })).toHaveLength(1);
});
