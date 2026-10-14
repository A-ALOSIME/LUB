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

it("renders request sections as RTL single-selection buttons and keeps their URL routes", () => {
  render(<MyRequestsTabs activeTab="applications" locale="ar"><div>محتوى الطلبات</div></MyRequestsTabs>);

  const group = screen.getByRole("group", { name: "أنواع طلباتي" });
  expect(group.getAttribute("dir")).toBe("rtl");
  expect(group.getAttribute("data-size")).toBe("default");
  const applicationsButton = within(group).getByRole("button", { name: "طلبات الانضمام" });
  expect(applicationsButton.getAttribute("aria-pressed")).toBe("true");
  expect(applicationsButton.className).toContain("aria-pressed:bg-primary");
  fireEvent.click(within(group).getByRole("button", { name: "طلبات التجديد" }));
  expect(push).toHaveBeenCalledWith("/applications?tab=renewals");
  expect(screen.getByText("محتوى الطلبات")).toBeTruthy();
});

it("lets the applications preview return to the saved requests view", () => {
  render(<MyRequestsTabs activeTab="applications" preview locale="ar"><div>المعاينة</div></MyRequestsTabs>);
  fireEvent.click(screen.getByRole("button", { name: "طلبات الانضمام" }));
  expect(push).toHaveBeenCalledWith("/applications?tab=applications");
});
