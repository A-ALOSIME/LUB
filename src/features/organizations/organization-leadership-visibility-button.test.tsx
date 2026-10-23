// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { OrganizationLeadershipVisibilityButton } from "./organization-leadership-switch";
import { ProfileFormContext } from "./profile-form-state";

afterEach(cleanup);

it("shows the saved leadership visibility in a labeled switch and explanatory card", () => {
  const { container, unmount } = render(<OrganizationLeadershipVisibilityButton defaultChecked locale="ar" />);
  expect(screen.getByText("الظهور للعامة")).toBeTruthy();
  const shown = screen.getByRole("switch", { name: "إظهار قيادة الجهة في الصفحة العامة" });
  expect(shown.getAttribute("aria-checked")).toBe("true");
  expect(shown.getAttribute("aria-describedby")).toBeTruthy();
  expect(container.querySelector<HTMLInputElement>('input[name="showLeadershipPublicly"]')?.value).toBe("on");
  expect(container.querySelector("[data-slot='card']")?.textContent).toContain("عند التفعيل");

  unmount();
  const hiddenRender = render(<OrganizationLeadershipVisibilityButton defaultChecked={false} locale="ar" />);
  const hidden = screen.getByRole("switch", { name: "إظهار قيادة الجهة في الصفحة العامة" });
  expect(hidden.getAttribute("aria-checked")).toBe("false");
  expect(hiddenRender.container.querySelector<HTMLInputElement>('input[name="showLeadershipPublicly"]')?.value).toBe("");
  expect(hiddenRender.container.querySelector("[data-slot='card']")?.textContent).toContain("الظهور للعامة");
});

it("marks the profile dirty when leadership visibility changes", () => {
  const markChanged = vi.fn();
  render(<ProfileFormContext.Provider value={{ resetKey: 0, resetValues: {}, markChanged }}>
    <OrganizationLeadershipVisibilityButton defaultChecked locale="ar" />
  </ProfileFormContext.Provider>);

  fireEvent.click(screen.getByRole("switch", { name: "إظهار قيادة الجهة في الصفحة العامة" }));

  expect(markChanged).toHaveBeenCalledOnce();
  expect(screen.getByRole("switch", { name: "إظهار قيادة الجهة في الصفحة العامة" }).getAttribute("aria-checked")).toBe("false");
});
