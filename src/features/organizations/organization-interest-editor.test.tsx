// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { OrganizationInterestEditor } from "./organization-interest-editor";

afterEach(cleanup);

describe("organization interest editor", () => {
  it("adds interests as chips and serializes them for the existing profile action", () => {
    render(<OrganizationInterestEditor initialInterests={["تقنية"]} locale="ar" />);
    const input = screen.getByRole("textbox", { name: "مجال اهتمام جديد" });
    expect(input.getAttribute("placeholder")).toBe("مثال: برمجة، أمن سيبراني");
    expect(input.getAttribute("dir")).toBe("rtl");
    fireEvent.change(input, { target: { value: "أمن سيبراني" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    expect(screen.getByText("أمن سيبراني")).toBeTruthy();
    expect(document.querySelector<HTMLInputElement>('input[name="tagNames"]')?.value).toBe("تقنية,أمن سيبراني");
    const helper = screen.getByText("أضف المجال بالضغط على Enter");
    const count = screen.getByText("2 من 10");
    expect(helper.parentElement).toBe(count.parentElement);
    expect(helper.parentElement?.classList.contains("organization-interest-meta")).toBe(true);
    expect(helper.parentElement?.getAttribute("dir")).toBe("rtl");
    expect(helper.getAttribute("dir")).toBe("rtl");
    expect(screen.queryByRole("button", { name: "إضافة المجال" })).toBeNull();
  });

  it("removes a chip and prevents duplicate interests", () => {
    render(<OrganizationInterestEditor initialInterests={["تقنية"]} locale="ar" />);
    const input = screen.getByRole("textbox", { name: "مجال اهتمام جديد" });
    fireEvent.change(input, { target: { value: "تقنية" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    expect(screen.getAllByText("تقنية")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "حذف تقنية" }));
    expect(document.querySelector<HTMLInputElement>('input[name="tagNames"]')?.value).toBe("");
  });
});
