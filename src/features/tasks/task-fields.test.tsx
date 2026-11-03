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
  it("keeps direct numeric hours without the retired rules selector", () => {
    const {container}=render(<TaskFields locale="ar" value={{default_hours:"8"}}/>);
    const input=screen.getByRole("spinbutton") as HTMLInputElement;
    expect(container.querySelectorAll('input[type="number"]')).toHaveLength(1);
    expect(input.value).toBe("8");fireEvent.change(input,{target:{value:"5"}});expect(input.value).toBe("5");
    expect(container.querySelector('[name="rule"]')).toBeNull();
    expect(screen.queryByRole("button",{name:"استخدم قاعدة"})).toBeNull();
    expect(screen.queryByRole("button",{name:"أدخل رقمًا"})).toBeNull();
  });
});
