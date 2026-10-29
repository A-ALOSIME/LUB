// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {CompactTimeInput} from "./compact-time-input";
import { TimeSelect, DateRangeInput } from "./date-input";

afterEach(cleanup);

describe("date range picker", () => {
  it("opens one Arabic Sunday-first calendar with both times inside it", () => {
    const { container } = render(<DateRangeInput
      startName="opens"
      endName="closes"
      label="فترة التسجيل"
      startValue="2026-09-01T09:00:00+03:00"
      endValue="2026-09-05T14:00:00+03:00"
      required
      includeTime
    />);

    fireEvent.click(screen.getByLabelText("فترة التسجيل"));

    expect(document.querySelector('[data-week-start="sunday"]')).toBeTruthy();
    expect(document.querySelector('[data-slot="popover-content"]')?.className).toContain("date-picker-popover");
    expect(screen.getByRole("textbox",{name:"البداية"})).toBeTruthy();
    expect(screen.getByRole("textbox",{name:"النهاية"})).toBeTruthy();
    expect(screen.queryByLabelText("الوقت")).toBeNull();
    expect(screen.getByText("بتوقيت الرياض")).toBeTruthy();
    expect(container.querySelector('input[type="time"]')).toBeNull();
    expect((container.querySelector('input[name="opens"]') as HTMLInputElement).value).toBe("2026-09-01T09:00:00+03:00");
    expect((container.querySelector('input[name="closes"]') as HTMLInputElement).value).toBe("2026-09-05T14:00:00+03:00");
  });
});

it("rejects an inverted period and shows a field error without submitting it",()=>{
 const {container}=render(<DateRangeInput startName="opens" endName="closes" label="الفترة" startValue="2026-10-26T12:00:00+03:00" endValue="2026-10-25T12:00:00+03:00" required includeTime/>);
 expect(screen.getByRole("alert").textContent).toContain("بعد البداية");expect((container.querySelector('input[name="closes"]') as HTMLInputElement).value).toBe("");
});

it("accepts numeric-keypad time entry and formats it on blur",()=>{
 const change=vi.fn(),valid=vi.fn();render(<CompactTimeInput label="البداية" value="12:00" onChange={change} onValidity={valid} locale="ar"/>);
 const input=screen.getByRole("textbox",{name:"البداية"});fireEvent.change(input,{target:{value:"1230"}});fireEvent.blur(input);
 expect((input as HTMLInputElement).value).toBe("١٢:٣٠");expect(change).toHaveBeenLastCalledWith("12:30");expect(valid).toHaveBeenLastCalledWith(true);
 fireEvent.change(input,{target:{value:"1300"}});expect(valid).toHaveBeenLastCalledWith(false);
});

it("keeps period actions outside the scrollable calendar and clears both submitted dates",()=>{
 const {container}=render(<DateRangeInput startName="opens" endName="closes" label="فترة اختبار" startValue="2026-10-26T10:30:00+03:00" endValue="2026-10-27T14:45:00+03:00" required includeTime/>);
 fireEvent.click(screen.getByRole("button",{name:"فترة اختبار"}));
 const footer=document.querySelector(".period-picker-footer")!,header=document.querySelector(".period-calendar-header")!;
 expect(footer.closest(".period-picker-middle")).toBeNull();expect(header.closest(".period-picker-middle")).toBeNull();
 expect(screen.getByRole("button",{name:"تم"}).hasAttribute("disabled")).toBe(false);
 fireEvent.click(screen.getByRole("button",{name:"مسح"}));
 expect(screen.getByRole("button",{name:"تم"}).hasAttribute("disabled")).toBe(true);
 expect(container.querySelector<HTMLInputElement>('input[name="opens"]')!.value).toBe("");expect(container.querySelector<HTMLInputElement>('input[name="closes"]')!.value).toBe("");
 expect((screen.getByRole("textbox",{name:"البداية"}) as HTMLInputElement).value).toBe("١٢:٠٠");expect((screen.getByRole("textbox",{name:"النهاية"}) as HTMLInputElement).value).toBe("١١:٥٩");
});

it("blocks saving an optional period that was started but left incomplete",()=>{
 const {container}=render(<form><DateRangeInput startName="starts" endName="ends" label="فترة اختيارية" startValue="2026-10-26T10:00:00+03:00" includeTime/></form>);
 const validity=container.querySelector<HTMLInputElement>('input[aria-hidden="true"]')!;expect(validity.required).toBe(true);expect(validity.validity.valid).toBe(false);
 fireEvent.invalid(validity);expect(screen.getByRole("alert").textContent).toContain("بداية الفترة ونهايتها");expect(document.activeElement).toBe(screen.getByRole("button",{name:"فترة اختيارية"}));
});

it("keeps time values machine-readable while displaying Arabic numerals",()=>{
 const change=vi.fn();const {container}=render(<TimeSelect label="وقت البداية" value="12:00" onChange={change} locale="ar"/>);
 fireEvent.change(container.querySelectorAll("select")[1],{target:{value:"30"}});
 expect(change).toHaveBeenLastCalledWith("12:30");
});
