// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({ mutateTalent: async () => ({ error: "تعذّر حفظ الملف" }) }));
vi.mock("@/features/forms/actions", () => ({ mutateWorkflow: vi.fn() }));

import { HiddenSwitch, NewProject } from "./form";

afterEach(cleanup);

it("submits the current switch value as an explicit boolean", () => {
  const { container } = render(<form><HiddenSwitch name="visible" label="إظهار قناة التواصل للعامة" /></form>);
  const value = container.querySelector<HTMLInputElement>('input[name="visible"]')!;
  expect(value.value).toBe("false");
  fireEvent.click(screen.getByRole("switch", { name: "إظهار قناة التواصل للعامة" }));
  expect(value.value).toBe("true");
});

it("switches the verified source without submitting both task and contribution IDs", () => {
  const { container } = render(<NewProject sources={[
    { id: "00000000-0000-4000-8000-000000000001", kind: "Task", title: "مهمة" },
    { id: "00000000-0000-4000-8000-000000000002", kind: "Event", title: "مساهمة" },
  ]} />);
  expect(container.querySelector<HTMLInputElement>('input[name="participant"]')?.value).toBe("00000000-0000-4000-8000-000000000001");
  fireEvent.change(screen.getByLabelText("النشاط الموثق"), { target: { value: "00000000-0000-4000-8000-000000000002" } });
  expect(container.querySelector('input[name="participant"]')).toBeNull();
  expect(container.querySelector<HTMLInputElement>('input[name="contribution"]')?.value).toBe("00000000-0000-4000-8000-000000000002");
  expect((screen.getByRole("switch", { name: "إبراز الإنجاز في أعلى الملف" }) as HTMLButtonElement).getAttribute("aria-checked")).toBe("false");
});
