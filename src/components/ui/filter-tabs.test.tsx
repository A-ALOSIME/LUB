// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { FilterTabs } from "./filter-tabs";

afterEach(cleanup);

it("renders compact filters as shadcn tabs with one rounded active option", () => {
  const onValueChange = vi.fn();
  const { container } = render(<FilterTabs
    value="all"
    ariaLabel="Filter by status"
    options={[{ value: "all", label: "All" }, { value: "active", label: "Active", count: 2 }]}
    onValueChange={onValueChange}
  />);

  expect(screen.getByRole("tablist", { name: "Filter by status" })).toBeTruthy();
  expect(screen.getByRole("tab", { name: "All" }).getAttribute("aria-selected")).toBe("true");
  expect(container.querySelector('[data-slot="toggle-group"]')).toBeNull();
  expect(container.querySelector('[data-slot="tabs-list"]')?.classList.contains("workspace-filter-control")).toBe(true);

  fireEvent.click(screen.getByRole("tab", { name: "Active2" }));
  expect(onValueChange).toHaveBeenCalledWith("active");
});
