// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { WorkspaceStickySaveBar } from "./workspace-sticky-save-bar";

afterEach(cleanup);

it("shows no bar while the form is clean", () => {
  render(<WorkspaceStickySaveBar formId="profile-form" locale="ar" visible={false} pending={false} onUndo={vi.fn()} />);

  expect(screen.queryByRole("status")).toBeNull();
});

it("associates save with its form and exposes undo", () => {
  const onUndo = vi.fn();
  render(<WorkspaceStickySaveBar formId="profile-form" locale="ar" visible pending={false} onUndo={onUndo} />);

  expect(screen.getByText("لديك تغييرات غير محفوظة")).toBeTruthy();
  expect(screen.getByRole("button", { name: "حفظ" }).getAttribute("form")).toBe("profile-form");
  fireEvent.click(screen.getByRole("button", { name: "تراجع" }));
  expect(onUndo).toHaveBeenCalledOnce();
});
