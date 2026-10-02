// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const action = vi.hoisted(() => vi.fn());
vi.mock("./actions", () => ({ saveProfile: action }));
import { ProfileForm } from "./profile-form";
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("profile form interactions", () => {
  it("retains entries and privacy choices after server validation fails", async () => {
    action.mockResolvedValue({ error: "راجع الرقم الجامعي.", fieldErrors: { universityId: ["أدخل رقمًا صحيحًا."] } });
    render(<ProfileForm email="student@example.com" />);
    fireEvent.change(screen.getByLabelText("الاسم الكامل بالعربية"), { target: { value: "أحمد محمد" } });
    fireEvent.change(screen.getByLabelText("الرقم الجامعي"), { target: { value: "invalid-number" } });
    fireEvent.change(screen.getByLabelText("التخصص"), { target: { value: "نظم المعلومات" } });
    fireEvent.change(screen.getByLabelText("المستوى الدراسي"), { target: { value: "5" } });
    fireEvent.click(screen.getByLabelText(/السماح بظهور ملفي العام/));
    fireEvent.submit(screen.getByRole("button", { name: "حفظ ومتابعة" }).closest("form")!);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("راجع الرقم"));
    expect((screen.getByLabelText("الاسم الكامل بالعربية") as HTMLInputElement).value).toBe("أحمد محمد");
    expect((screen.getByLabelText("الرقم الجامعي") as HTMLInputElement).value).toBe("invalid-number");
    expect((screen.getByLabelText(/السماح بظهور ملفي العام/) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByLabelText("الرقم الجامعي").getAttribute("aria-invalid")).toBe("true");
  });
  it("edits stored data without requesting the university number again", () => {
    render(<ProfileForm email="student@example.com" profile={{ fullName: "أحمد محمد", major: "نظم المعلومات", academicLevel: "5", phone: null, publicProfileEnabled: false, showTotalHours: true }} />);
    expect(screen.queryByLabelText("الرقم الجامعي")).toBeNull();
    expect(screen.getByRole("button", { name: "حفظ التعديلات" })).toBeTruthy();
    expect((screen.getByLabelText("التخصص") as HTMLInputElement).value).toBe("نظم المعلومات");
  });
});
