// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { previewApplications } from "./application-preview";
import { ApplicationList } from "./application-list";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => <a href={href} {...props}>{children}</a>,
}));
vi.mock("./actions", () => ({ mutateWorkflow: vi.fn() }));

afterEach(cleanup);

it("shows an explicitly temporary, non-interactive preview with representative application states", () => {
  render(<ApplicationList rows={previewApplications} locale="ar" preview />);

  expect(screen.getByRole("note").textContent).toContain("بيانات تجريبية");
  expect(screen.getByText("نادي الأمن السيبراني")).toBeTruthy();
  expect(screen.getByText("قيد المراجعة")).toBeTruthy();
  expect(screen.getByText("مقابلة")).toBeTruthy();
  expect(screen.getByText("منسحب")).toBeTruthy();
  expect(screen.getByText("مقبول")).toBeTruthy();
  expect(screen.getAllByRole("button", { name: "سحب الطلب" }).every(button => button.hasAttribute("disabled"))).toBe(true);
  expect(screen.getByRole("button", { name: "قدّم مرة أخرى" }).hasAttribute("disabled")).toBe(true);
  expect(screen.queryByRole("link", { name: "قدّم مرة أخرى" })).toBeNull();
});
