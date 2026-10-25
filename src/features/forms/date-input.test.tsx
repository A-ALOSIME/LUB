// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {CompactTimeInput} from "./compact-time-input";
import { DateRangeInput } from "./date-input";

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
 expect((input as HTMLInputElement).value).toBe("12:30");expect(change).toHaveBeenLastCalledWith("12:30");expect(valid).toHaveBeenLastCalledWith(true);
 fireEvent.change(input,{target:{value:"1300"}});expect(valid).toHaveBeenLastCalledWith(false);
});
