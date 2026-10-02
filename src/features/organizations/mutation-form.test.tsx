// @vitest-environment jsdom
import { act } from "react";
import { render, fireEvent, screen, cleanup, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ mutate: vi.fn() }));
vi.mock("./actions", () => ({ mutateOrganization: mocks.mutate }));
import { MutationForm } from "./mutation-form";
beforeEach(() => { mocks.mutate.mockReset(); });
afterEach(cleanup);
it("preserves typed input and confirmation after a rejected action and announces the error", async () => {
  mocks.mutate.mockResolvedValue({ error: "تعذّر التنفيذ." });
  render(<MutationForm operation="appoint-leader" submitLabel="تعيين القائد" confirmLabel="أؤكد التعيين"><label htmlFor="candidate">البريد</label><input id="candidate" name="email" type="email" /></MutationForm>);
  fireEvent.change(screen.getByLabelText("البريد"), { target: { value: "member@example.com" } });
  fireEvent.click(screen.getByLabelText("أؤكد التعيين"));
  await act(async () => { fireEvent.submit(screen.getByRole("button", { name: "تعيين القائد" }).closest("form")!); });
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("تعذّر التنفيذ."));
  expect((screen.getByLabelText("البريد") as HTMLInputElement).value).toBe("member@example.com");
  expect((screen.getByLabelText("أؤكد التعيين") as HTMLInputElement).checked).toBe(true);
});
it("shows the result of the completed action without duplicating it", async () => {
  mocks.mutate.mockResolvedValue({ success: "تم الحفظ." });
  render(<MutationForm operation="copy-committee" submitLabel="نسخ اللجنة" fields={{ organizationId: "org", committeeId: "committee" }} />);
  await act(async () => { fireEvent.submit(screen.getByRole("button", { name: "نسخ اللجنة" }).closest("form")!); });
  await waitFor(() => expect(screen.getByRole("status").textContent).toContain("تم الحفظ."));
  expect(mocks.mutate).toHaveBeenCalledTimes(1);
});
