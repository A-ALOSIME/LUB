// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { ApplicationRowActions } from "./application-row-actions";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => <a href={href} {...props}>{children}</a>,
}));
vi.mock("./mutation-form", () => ({
  WorkflowForm: ({ label }: { label: string }) => <button type="button">{label}</button>,
}));

afterEach(cleanup);

const baseProps = {
  applicationId: "00000000-0000-4000-8000-000000000001",
  organization: "نادي الأمن السيبراني",
  detailsHref: "/organizations/cybersecurity/apply/round",
  canWithdraw: true,
  locale: "ar" as const,
  preview: false,
};

it("offers details and asks for confirmation before withdrawal", async () => {
  render(<ApplicationRowActions {...baseProps} />);

  fireEvent.click(screen.getByRole("button", { name: "إجراءات نادي الأمن السيبراني" }));
  const details = await screen.findByRole("menuitem", { name: /عرض التفاصيل/ });
  expect(details.getAttribute("href")).toBe(baseProps.detailsHref);

  fireEvent.click(await screen.findByRole("menuitem", { name: /سحب الطلب/ }));
  expect(await screen.findByRole("alertdialog")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "تأكيد سحب الطلب" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "اسحب الطلب" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "إبقاء الطلب" })).toBeTruthy();
});

it("does not show withdrawal when the request is not eligible", async () => {
  render(<ApplicationRowActions {...baseProps} canWithdraw={false} />);
  fireEvent.click(screen.getByRole("button", { name: "إجراءات نادي الأمن السيبراني" }));

  expect(await screen.findByRole("menuitem", { name: /عرض التفاصيل/ })).toBeTruthy();
  expect(screen.queryByRole("menuitem", { name: /سحب الطلب/ })).toBeNull();
});
