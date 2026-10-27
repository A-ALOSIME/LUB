// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MyRequestsTabs } from "./my-requests-tabs";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

afterEach(() => {
  cleanup();
  push.mockClear();
});

it("renders request sections as shadcn tabs and keeps their URL routes", () => {
  render(<MyRequestsTabs activeTab="applications" locale="ar"><div>محتوى الطلبات</div></MyRequestsTabs>);

  const tablist = screen.getByRole("tablist", { name: "أنواع طلباتي" });
  expect(tablist.parentElement?.classList.contains("workspace-filter-scroll")).toBe(true);
  expect(tablist.parentElement?.getAttribute("dir")).toBe("rtl");
  const applicationsTab = within(tablist).getByRole("tab", { name: "طلبات الانضمام" });
  expect(applicationsTab.getAttribute("aria-selected")).toBe("true");
  expect(applicationsTab.className).toContain("data-active:bg-primary");
  fireEvent.click(within(tablist).getByRole("tab", { name: "طلبات التجديد" }));
  expect(push).toHaveBeenCalledWith("/applications?tab=renewals");
  expect(screen.getByText("محتوى الطلبات")).toBeTruthy();
});

it("lets the applications preview return to the saved requests view", () => {
  render(<MyRequestsTabs activeTab="applications" preview locale="ar"><div>المعاينة</div></MyRequestsTabs>);
  fireEvent.click(screen.getByRole("tab", { name: "طلبات الانضمام" }));
  expect(push).toHaveBeenCalledWith("/applications?tab=applications");
});
it('opens the organization request category with a persistent URL',()=>{render(<MyRequestsTabs activeTab="applications" locale="ar"><div>طلباتي</div></MyRequestsTabs>);fireEvent.click(screen.getByRole('tab',{name:'طلبات فتح الأندية'}));expect(push).toHaveBeenCalledWith('/applications?tab=organizations');});
