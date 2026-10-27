// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { ApplicationForm } from "./application-form";
import { initialDefinition, type FormDefinition } from "./definition";
vi.mock("./mutation-form", () => ({
  WorkflowForm: ({ children }: { children: ReactNode }) => (
    <form>{children}</form>
  ),
}));
afterEach(cleanup);
const committee = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "الأنشطة / الفعاليات",
};
const field = {
  id: "00000000-0000-4000-8000-000000000002",
  type: "Committee" as const,
  label: "اختر فريقك",
  help: "",
  required: false,
  options: [],
  maxLength: 300,
};
it("shows no automatic committee field and refreshes explicit question options from current data", () => {
  const { rerender } = render(
    <ApplicationForm
      round="round"
      version="version"
      definition={initialDefinition}
      committees={[committee]}
    />,
  );
  expect(screen.queryByRole("combobox")).toBeNull();
  const definition: FormDefinition = {
    ...initialDefinition,
    sections: [{ ...initialDefinition.sections[0], fields: [field] }],
  };
  rerender(
    <ApplicationForm
      round="round"
      version="version"
      definition={definition}
      committees={[committee]}
    />,
  );
  expect(
    screen.getByRole("combobox", { name: "اختر فريقك (اختياري)" }),
  ).toBeTruthy();
  expect(document.querySelector("select")?.textContent).toContain(
    "الأنشطة / الفعاليات",
  );
  rerender(
    <ApplicationForm
      round="round"
      version="version"
      definition={definition}
      committees={[]}
    />,
  );
  expect(document.querySelector("select")?.textContent).not.toContain(
    "الأنشطة / الفعاليات",
  );
});
