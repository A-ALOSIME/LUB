// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const actions = vi.hoisted(() => ({ requestCode: vi.fn(), verifyCode: vi.fn() }));
vi.mock("./actions", () => actions);
import { AuthForm } from "./auth-form";
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe("OTP form interactions", () => {
  it("disables provider requests when setup is missing", () => {
    render(<AuthForm mode="signup" available={false} />);
    expect((screen.getByRole("button", { name: "إرسال رمز التحقق" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toContain("غير متاح");
  });
  it("moves from email to verification and clears stale errors on resend", async () => {
    actions.requestCode.mockResolvedValue({ email: "student@example.com" });
    actions.verifyCode.mockResolvedValue({ error: "الرمز غير صحيح." });
    render(<AuthForm mode="login" available />);
    fireEvent.change(screen.getByLabelText("البريد الإلكتروني"), { target: { value: "student@example.com" } });
    fireEvent.submit(screen.getByRole("button", { name: "إرسال رمز التحقق" }).closest("form")!);
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("رمز تحقق"));
    expect(screen.getByLabelText("رمز التحقق")).toBeTruthy();
    expect((screen.getByLabelText("رمز التحقق") as HTMLInputElement).maxLength).toBe(6);
    fireEvent.change(screen.getByLabelText("رمز التحقق"), { target: { value: "123456" } });
    fireEvent.submit(screen.getByRole("button", { name: "تحقق وادخل" }).closest("form")!);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("غير صحيح"));
    fireEvent.click(screen.getByRole("button", { name: "تغيير البريد أو طلب رمز جديد" }));
    fireEvent.submit(screen.getByRole("button", { name: "إرسال رمز التحقق" }).closest("form")!);
    await waitFor(() => expect(screen.getByLabelText("رمز التحقق")).toBeTruthy());
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("collects the full student profile before sending a signup code", async () => {
    actions.requestCode.mockResolvedValue({ email: "student@example.com" });
    render(<AuthForm mode="signup" available locale="en" />);
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "student@example.com" } });
    fireEvent.change(screen.getByLabelText("Full name in Arabic"), { target: { value: "أحمد محمد" } });
    fireEvent.change(screen.getByLabelText("University number"), { target: { value: "202612345" } });
    fireEvent.change(screen.getByLabelText("Major"), { target: { value: "Information Systems" } });
    fireEvent.change(screen.getByLabelText("Academic level"), { target: { value: "5" } });
    fireEvent.submit(screen.getByRole("button", { name: "Send verification code" }).closest("form")!);
    await waitFor(() => expect(screen.getByLabelText("Verification code")).toBeTruthy());
    expect(screen.getByRole("button", { name: "Verify and create account" })).toBeTruthy();
    const verifyForm = screen.getByRole("button", { name: "Verify and create account" }).closest("form")!;
    expect(new FormData(verifyForm).get("mode")).toBe("signup");
    expect(new FormData(verifyForm).get("universityId")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Change details or request a new code" }));
    expect((screen.getByLabelText("University number") as HTMLInputElement).value).toBe("202612345");
  });
  it("explains where to look when the signup code does not arrive", async () => {
    actions.requestCode.mockResolvedValue({ email: "student@example.com" });
    render(<AuthForm mode="signup" available />);
    fireEvent.change(screen.getByLabelText("البريد الإلكتروني"), { target: { value: "student@example.com" } });
    fireEvent.change(screen.getByLabelText("الاسم الكامل بالعربية"), { target: { value: "أحمد محمد" } });
    fireEvent.change(screen.getByLabelText("الرقم الجامعي"), { target: { value: "202612345" } });
    fireEvent.change(screen.getByLabelText("التخصص"), { target: { value: "نظم المعلومات" } });
    fireEvent.change(screen.getByLabelText("المستوى الدراسي"), { target: { value: "5" } });
    fireEvent.submit(screen.getByRole("button", { name: "إرسال رمز التحقق" }).closest("form")!);

    await waitFor(() => expect(screen.getByLabelText("رمز التحقق")).toBeTruthy());
    expect(screen.getByText(/البريد العشوائي \(Spam\) أو الرسائل المحجوزة في بريد الجامعة/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "تعديل البيانات أو طلب رمز جديد" })).toBeTruthy();
  });
});
