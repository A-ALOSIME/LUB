// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { previewApplications } from "./application-preview";
import { ApplicationList } from "./application-list";
import { countApplicationStatuses } from "./application-status";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => <a href={href} {...props}>{children}</a>,
}));
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
  expect(screen.getByRole("link", { name: /الكل/ }).textContent).toContain("5");
  expect(screen.getByRole("link", { name: /قيد المراجعة/ }).textContent).toContain("2");
  expect(screen.getByRole("link", { name: /مقبول/ }).textContent).toContain("1");
  expect(screen.getByRole("link", { name: /مرفوض/ }).textContent).toContain("1");
  expect(screen.getByRole("link", { name: /مسحوب/ }).textContent).toContain("1");
  expect(screen.getAllByRole("button", { name: "إجراءات الطلب" }).every(button => button.hasAttribute("disabled"))).toBe(true);
  expect(screen.queryByText("المراجع")).toBeNull();
  expect(screen.queryByText("السحب والإفلات")).toBeNull();
});

it("explains the first-time empty state and links to the organization directory", () => {
  render(<ApplicationList
    rows={[]}
    counts={countApplicationStatuses([])}
    locale="ar"
    status="all"
  />);

  expect(screen.getAllByText("ما قدمت على أي جهة حتى الآن.")).toHaveLength(2);
  expect(screen.getAllByRole("link", { name: "استكشف الجهات" })).toHaveLength(2);
});
