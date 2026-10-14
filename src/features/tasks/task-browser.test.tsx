// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import type { TaskCard } from "./repository";
import { TaskBrowser } from "./task-browser";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => <a href={href} {...props}>{children}</a>,
}));

afterEach(cleanup);

function card({
  id,
  title,
  status = "Open",
  participant = null,
  historical = false,
  latestSubmission = null,
  approvedHours = null,
}: {
  id: string;
  title: string;
  status?: string;
  participant?: TaskCard["participant"];
  historical?: boolean;
  latestSubmission?: TaskCard["latest_submission"];
  approvedHours?: string | null;
}): TaskCard {
  return {
    task: {
      id,
      organization_id: "organization",
      committee_id: null,
      title,
      description: "وصف المهمة",
      starts_at: null,
      due_at: null,
      default_hours: "2",
      status_code: status,
      revision: 1,
      task_template_id: null,
    },
    org_name: "نادي التقنية",
    participant,
    historical,
    latest_submission: latestSubmission,
    approved_hours: approvedHours,
  } as TaskCard;
}

const joinedTask = card({
  id: "joined",
  title: "مهمة أنا منضم لها",
  participant: {
    id: "participation",
    user_id: "student",
    status_code: "In_Progress",
    approved_hours_override: null,
    joined_at: "2026-10-12T00:00:00.000Z",
    closed_at: null,
  },
  latestSubmission: { status_code: "Submitted" },
});

it("switches instantly between open tasks and all current or past participations", () => {
  const view = render(<TaskBrowser
    availableItems={[card({ id: "available", title: "مهمة متاحة" }), joinedTask]}
    mineItems={[
      joinedTask,
      card({
        id: "finished",
        title: "مهمة منتهية",
        status: "Completed",
        participant: { ...joinedTask.participant!, status_code: "Approved", closed_at: "2026-10-13T00:00:00.000Z", approved_hours_override: "4.5" },
        latestSubmission: { status_code: "Approved" },
        approvedHours: "4.5",
      }),
      card({ id: "historical", title: "مهمة من سجل سابق", historical: true, participant: joinedTask.participant }),
    ]}
    locale="ar"
  />);

  const available = screen.getByRole("button", { name: "المتاحة" });
  const mine = screen.getByRole("button", { name: "مشاركاتي" });
  expect(available.getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByText("مهمة متاحة")).toBeTruthy();
  expect(screen.getByText("منضم")).toBeTruthy();
  expect(screen.queryByText("مهمة منتهية")).toBeNull();

  fireEvent.click(mine);

  expect(mine.getAttribute("aria-pressed")).toBe("true");
  const finished = screen.getByText("مهمة منتهية").closest("li");
  expect(finished?.textContent).toContain("حالة التسليم: معتمدة");
  expect(finished?.textContent).toContain("الساعات المعتمدة: 4.5");
  expect(screen.getByText("مهمة من سجل سابق")).toBeTruthy();
  expect(screen.queryByText("مهمة متاحة")).toBeNull();

  fireEvent.click(available);
  expect(view.container.querySelector('[aria-label="تصفية المهام"]')?.getAttribute("dir")).toBe("rtl");
  expect(screen.getByText("مهمة متاحة")).toBeTruthy();
});

it("shows a compact empty message that follows the selected filter", () => {
  render(<TaskBrowser availableItems={[]} mineItems={[]} locale="ar" />);

  expect(screen.getByRole("status").textContent).toContain("لا توجد مهام متاحة");
  fireEvent.click(screen.getByRole("button", { name: "مشاركاتي" }));
  expect(screen.getByRole("status").textContent).toContain("ما شاركت");
});
