// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const mutate = vi.hoisted(() => vi.fn<(state: unknown, form: FormData) => Promise<{ success: string }>>());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("./actions", () => ({ mutateTask: mutate }));
vi.mock("@/features/talent/activity-skill-actions", () => ({ searchActivitySkills: vi.fn().mockResolvedValue([]) }));
vi.mock("@/features/events/event-poster-field", () => ({
  EntityImageField: ({ initialPreview, purpose }: { initialPreview?: string; purpose: string }) =>
    <div data-testid="image-field" data-src={initialPreview} data-purpose={purpose}/>,
}));

import { TaskComposer, TaskEditorForm } from "./task-composer";
import { TaskDecision } from "./task-decision";
import type { Task, TaskWorkspace } from "./repository";

const workspace: TaskWorkspace = { name: "الجهة", scopes: [{ id: null, name: "الجهة بالكامل" }, { id: "media", name: "الإعلام" }] };
const task: Task = { id: "task", organization_id: "org", committee_id: null, title: "تصميم الهوية",
  description: "وصف المخرج", default_hours: "3", status_code: "Draft", revision: 2, starts_at: null, due_at: null,
  image_asset_id: "image" };
afterEach(() => { cleanup(); mutate.mockReset(); });

it("opens a new task directly with available scopes and keeps the populated editor for existing tasks", async () => {
  const view = render(<TaskComposer org="org" workspace={workspace} locale="ar"/>);
  fireEvent.click(screen.getByRole("button", { name: "مهمة جديدة" }));
  const dialog = within(screen.getByRole("dialog"));
  expect(dialog.getByRole("combobox", { name: "نطاق العمل" })).toBeTruthy();
  fireEvent.click(dialog.getByRole("combobox", { name: "نطاق العمل" }));
  expect(await screen.findByRole("option", { name: "الإعلام" })).toBeTruthy();
  expect(dialog.queryByText("ابدأ من قالب")).toBeNull();
  expect(dialog.queryByRole("button", { name: "حفظ كقالب" })).toBeNull();
  view.unmount();
  render(<TaskEditorForm org="org" workspace={workspace} task={task}/>);
  expect((screen.getByRole("textbox", { name: /العنوان/ }) as HTMLInputElement).value).toBe(task.title);
  expect(screen.getByTestId("image-field").getAttribute("data-src")).toBe("/files/image/preview");
  expect(screen.getByTestId("image-field").getAttribute("data-purpose")).toBe("task-image");
});

it("confirms duplication explicitly and leaves the existing row alone", async () => {
  mutate.mockResolvedValue({ success: "تم الحفظ" });
  const optimistic = vi.fn();
  render(<TaskDecision kind="duplicate" task="task" revision={2} title="Design" locale="en" optimistic={optimistic}/>);
  fireEvent.click(screen.getByRole("button", { name: "Duplicate task" }));
  const dialog = within(screen.getByRole("alertdialog"));
  expect(dialog.getByText(/separate draft/)).toBeTruthy();
  expect(mutate).not.toHaveBeenCalled();
  fireEvent.click(dialog.getByRole("button", { name: "Duplicate task" }));
  await waitFor(() => expect(mutate).toHaveBeenCalledOnce());
  expect(mutate.mock.calls[0][1].get("operation")).toBe("duplicate");
  expect(mutate.mock.calls[0][1].get("task")).toBe("task");
  expect(optimistic).not.toHaveBeenCalled();
});
