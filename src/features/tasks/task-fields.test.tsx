// @vitest-environment jsdom
vi.mock("@/features/talent/activity-skill-actions",()=>({searchActivitySkills:vi.fn().mockResolvedValue([])}));
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/manage/organizations/org-1/tasks",
  useRouter: () => ({ replace: vi.fn() }),
}));

import { TaskFields } from "./task-fields";

afterEach(cleanup);

describe("task hours field", () => {
  it("switches the same field between manual hours and a rule", () => {
    const { container } = render(<TaskFields locale="ar" rules={[{
      id: "rule-1",
      name: "تنظيم فعالية",
      default_hours: "8",
      committee_id: null,
      task_template_id: null,
    }]} />);

    expect(container.querySelectorAll('input[type="number"]')).toHaveLength(1);
    expect(container.querySelector('select[name="rule"]')).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "استخدم قاعدة" }));
    expect(container.querySelectorAll('input[type="number"]')).toHaveLength(0);
    expect((container.querySelector('select[name="rule"]') as HTMLSelectElement).value).toBe("rule-1");
    expect((container.querySelector('input[name="hours"]') as HTMLInputElement).value).toBe("8");

    fireEvent.click(screen.getByRole("button", { name: "أدخل رقمًا" }));
    expect(container.querySelectorAll('input[type="number"]')).toHaveLength(1);
    expect(container.querySelector('input[name="rule"]')).toBeTruthy();
    expect(container.querySelector('select[name="rule"]')).toBeNull();
  });
});
