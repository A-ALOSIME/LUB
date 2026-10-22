// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { OrganizationStatusBadge } from "./organization-status-badge";

afterEach(cleanup);

it("uses one size with semantic colors for organization states", () => {
  const { rerender } = render(<OrganizationStatusBadge status="active">نشطة</OrganizationStatusBadge>);
  const active = screen.getByText("نشطة");
  expect(active.classList.contains("organization-status-badge--positive")).toBe(true);
  expect(active.classList.contains("h-5")).toBe(true);

  rerender(<OrganizationStatusBadge status="rejected">مرفوض</OrganizationStatusBadge>);
  expect(screen.getByText("مرفوض").classList.contains("organization-status-badge--negative")).toBe(true);

  rerender(<OrganizationStatusBadge status="draft">مسودة</OrganizationStatusBadge>);
  expect(screen.getByText("مسودة").classList.contains("organization-status-badge--warning")).toBe(true);
});
