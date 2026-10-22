// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ApplicationSelection } from "./application-selection";

vi.mock("./actions", () => ({ mutateWorkflow: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/manage/organizations/org/applications",
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(cleanup);

it("uses a compact empty state instead of an empty table", () => {
  render(<ApplicationSelection rows={[]} locale="ar" canBulk={false} query="" />);

  expect(screen.queryByRole("table")).toBeNull();
  expect(screen.getByRole("status").textContent).toContain("لا توجد طلبات مطابقة");
});
