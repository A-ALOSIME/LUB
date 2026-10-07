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
  it("shows the code flow directly in English without a link option", async () => {
    actions.requestCode.mockResolvedValue({ email: "student@example.com" });
    render(<AuthForm mode="signup" available locale="en" />);
    expect(screen.getByText(/email you a 6-digit code/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "student@example.com" } });
    fireEvent.submit(screen.getByRole("button", { name: "Send verification code" }).closest("form")!);
    await waitFor(() => expect(screen.getByLabelText("Verification code")).toBeTruthy());
    expect(screen.queryByText(/link/i)).toBeNull();
  });
});
