// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MyRequestsTabs } from "./my-requests-tabs";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

afterEach(() => {
  cleanup();
  push.mockClear();
});

it("shows the URL-selected tab in RTL and navigates to renewals when selected", () => {
  render(<MyRequestsTabs activeTab="applications" locale="ar"><p>Application content</p></MyRequestsTabs>);

  expect(screen.getByRole("tab", { name: "طلبات الانضمام" }).getAttribute("aria-selected")).toBe("true");
  expect(screen.getByRole("tab", { name: "طلبات التجديد" }).getAttribute("aria-selected")).toBe("false");
  expect(screen.getByRole("tabpanel").getAttribute("dir")).toBe("rtl");

  fireEvent.click(screen.getByRole("tab", { name: "طلبات التجديد" }));

  expect(push).toHaveBeenCalledWith("/applications?tab=renewals");
});

it("lets the selected applications tab leave preview mode without a return button", () => {
  render(<MyRequestsTabs activeTab="applications" preview locale="ar"><p>Preview content</p></MyRequestsTabs>);

  fireEvent.click(screen.getByRole("tab", { name: "طلبات الانضمام" }));

  expect(push).toHaveBeenCalledWith("/applications?tab=applications");
});
