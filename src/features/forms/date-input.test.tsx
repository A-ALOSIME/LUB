// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DateRangeInput } from "./date-input";

afterEach(cleanup);

describe("date range picker", () => {
  it("opens one Arabic Saturday-first calendar with both times inside it", () => {
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

    expect(document.querySelector('[data-week-start="saturday"]')).toBeTruthy();
    expect(document.querySelector('[data-slot="popover-content"]')?.className).toContain("date-picker-popover");
    expect(screen.getByLabelText("وقت البداية")).toBeTruthy();
    expect(screen.getByLabelText("وقت النهاية")).toBeTruthy();
    expect(screen.queryByLabelText("الوقت")).toBeNull();
    expect(screen.getByText("كل الأوقات بتوقيت الرياض")).toBeTruthy();
    expect(container.querySelector('input[type="time"]')).toBeNull();
    expect((container.querySelector('input[name="opens"]') as HTMLInputElement).value).toBe("2026-09-01T09:00:00+03:00");
    expect((container.querySelector('input[name="closes"]') as HTMLInputElement).value).toBe("2026-09-05T14:00:00+03:00");
  });
});
