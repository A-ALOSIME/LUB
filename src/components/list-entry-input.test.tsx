// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ListEntryInput } from "./list-entry-input";

afterEach(cleanup);
it("keeps existing newline entries and adds and removes badges without submitting the form", () => {
  function Example() {
    const [value, setValue] = useState("برنامج أول\nبرنامج ثانٍ");
    return <form><ListEntryInput id="programs" label="البرامج" value={value} onChange={setValue} locale="ar" /><input name="serialized" type="hidden" value={value} readOnly /></form>;
  }
  const { container } = render(<Example />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "برنامج جديد" } });
  fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
  expect(container.querySelectorAll('[data-slot="badge"]')).toHaveLength(3);
  expect(new FormData(container.querySelector("form")!).get("serialized")).toBe("برنامج أول\nبرنامج ثانٍ\nبرنامج جديد");
  fireEvent.click(screen.getByRole("button", { name: "حذف برنامج ثانٍ" }));
  expect(new FormData(container.querySelector("form")!).get("serialized")).toBe("برنامج أول\nبرنامج جديد");
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "برنامج أول" } });
  fireEvent.click(screen.getByRole("button", { name: "إضافة" }));
  expect(screen.getByRole("alert").textContent).toContain("غير مكرر");
});
