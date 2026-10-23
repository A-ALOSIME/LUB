// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { PhoneInput } from "./phone-input";
import { joinPhone, splitPhone } from "@/lib/phone";

afterEach(cleanup);

it("splits saved international numbers and combines a country change without reversing digits", () => {
  const { container } = render(<form><label htmlFor="phone">الجوال</label><PhoneInput id="phone" name="phone" defaultValue="+966506502858" /></form>);
  const phone = screen.getByRole("textbox", { name: "الجوال" });
  expect(phone.getAttribute("dir")).toBe("ltr");
  expect(phone).toHaveProperty("value", "506502858");
  expect(screen.getByRole("combobox", { name: "رمز الدولة" })).toHaveProperty("value", "966");
  fireEvent.change(phone, { target: { value: "٠٥٠١٢٣٤٥٦٧" } });
  expect(new FormData(container.querySelector("form")!).get("phone")).toBe("+966501234567");
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "971" } });
  fireEvent.change(phone, { target: { value: "501234567" } });
  expect(new FormData(container.querySelector("form")!).get("phone")).toBe("+971501234567");
  fireEvent.change(phone, { target: { value: "" } });
  expect(new FormData(container.querySelector("form")!).get("phone")).toBe("");
});

it("handles an international paste, Saudi national values and significant international zeroes", () => {
  expect(splitPhone("00971501234567")).toEqual({ code: "971", number: "501234567" });
  expect(splitPhone("0501234567")).toEqual({ code: "966", number: "0501234567" });
  expect(splitPhone("966501234567")).toEqual({ code: "966", number: "501234567" });
  expect(joinPhone("39", "0612345678")).toBe("+390612345678");
});
