// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ManagementActionFooter, ManagementActionSheet } from "./management-action-sheet";

afterEach(cleanup);

describe("management action sheet", () => {
  it("keeps long fields out of the page until the action is opened", () => {
    render(<ManagementActionSheet label="مهمة جديدة" title="إنشاء مهمة"><label>العنوان<input name="title"/></label></ManagementActionSheet>);

    expect(screen.queryByRole("textbox", { name: "العنوان" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "مهمة جديدة" }));
    expect(screen.getByRole("textbox", { name: "العنوان" })).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.queryByText("أكمل الحقول ثم احفظ.")).toBeNull();
  });

  it("opens when arriving through a preselected template link", () => {
    render(<ManagementActionSheet label="إنشاء من القالب" title="إنشاء مهمة" initiallyOpen><label>العنوان<input name="title"/></label></ManagementActionSheet>);

    expect(screen.getByRole("textbox", { name: "العنوان" })).toBeTruthy();
  });

  it("lets the wide event dialog use its requested width without the default small-dialog cap", () => {
    render(<ManagementActionSheet label="فعالية جديدة" title="إنشاء فعالية" width="wide"><p>حقول الفعالية</p></ManagementActionSheet>);

    fireEvent.click(screen.getByRole("button", { name: "فعالية جديدة" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toContain("w-[min(42rem,calc(100vw-2rem))]");
    expect(dialog.className).toContain("max-w-2xl");
    expect(dialog.className).not.toContain("sm:max-w-sm");
  });

  it("keeps ordinary action dialogs at the compact default width", () => {
    render(<ManagementActionSheet label="إجراء" title="إجراء قصير"><p>محتوى</p></ManagementActionSheet>);

    fireEvent.click(screen.getByRole("button", { name: "إجراء" }));

    expect(screen.getByRole("dialog").className).toContain("sm:max-w-sm");
  });

  it("uses a left-side sheet only when explicitly requested", () => {
    render(<ManagementActionSheet label="فعالية جديدة" title="إنشاء فعالية" presentation="sheet"><p>المحتوى</p></ManagementActionSheet>);

    fireEvent.click(screen.getByRole("button", { name: "فعالية جديدة" }));
    expect(screen.getByRole("dialog").getAttribute("data-side")).toBe("left");
  });

  it("supports a controlled modal opened from a separate action menu", () => {
    function TestAction() {
      const [open, setOpen] = useState(false);
      return <>
        <Button type="button" onClick={() => setOpen(true)}>فتح الإجراء</Button>
        <ManagementActionSheet label="" title="إجراء العضو" open={open} onOpenChange={setOpen} hideTrigger>
          <p>تفاصيل الإجراء</p>
        </ManagementActionSheet>
      </>;
    }

    render(<TestAction/>);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "فتح الإجراء" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "إغلاق" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("provides one fixed save/cancel footer inside a shared dialog", () => {
    render(<ManagementActionSheet label="فتح النموذج" title="نموذج" locale="ar">
      <form><ManagementActionFooter label="حفظ" /></form>
    </ManagementActionSheet>);

    fireEvent.click(screen.getByRole("button", { name: "فتح النموذج" }));

    const footer = document.querySelector(".management-action-footer");
    expect(footer?.classList.contains("is-modal-footer")).toBe(true);
    expect(screen.getByRole("button", { name: "حفظ" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "إلغاء" })).toBeTruthy();
  });
});
