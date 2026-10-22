// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { OrganizationLeadershipVisibilityButton } from "./organization-leadership-switch";
import { ProfileFormContext } from "./profile-form-state";

afterEach(cleanup);

it("shows the saved leadership visibility state with the matching eye and tooltip", () => {
  const { container, unmount } = render(<OrganizationLeadershipVisibilityButton defaultChecked locale="ar" />);
  expect(screen.queryByText("الظهور")).toBeNull();
  const shown = screen.getByRole("button", { name: "قيادة الجهة: ظاهرة للعامة" });
  expect(shown.getAttribute("aria-pressed")).toBe("true");
  expect(shown.getAttribute("title")).toBe("إظهار قيادة الجهة في الصفحة العامة");
  expect(container.querySelector<HTMLInputElement>('input[name="showLeadershipPublicly"]')?.value).toBe("on");
  expect(container.querySelector("svg.lucide-eye")).toBeTruthy();

  unmount();
  const hiddenRender = render(<OrganizationLeadershipVisibilityButton defaultChecked={false} locale="ar" />);
  const hidden = screen.getByRole("button", { name: "قيادة الجهة: مخفية" });
  expect(hidden.getAttribute("aria-pressed")).toBe("false");
  expect(hiddenRender.container.querySelector<HTMLInputElement>('input[name="showLeadershipPublicly"]')?.value).toBe("");
  expect(hiddenRender.container.querySelector("svg.lucide-eye-off")).toBeTruthy();
});

it("marks the profile dirty when leadership visibility changes", () => {
  const markChanged = vi.fn();
  render(<ProfileFormContext.Provider value={{ resetKey: 0, resetValues: {}, markChanged }}>
    <OrganizationLeadershipVisibilityButton defaultChecked locale="ar" />
  </ProfileFormContext.Provider>);

  fireEvent.click(screen.getByRole("button", { name: "قيادة الجهة: ظاهرة للعامة" }));

  expect(markChanged).toHaveBeenCalledOnce();
  expect(screen.getByRole("button", { name: "قيادة الجهة: مخفية" }).getAttribute("aria-pressed")).toBe("false");
});
