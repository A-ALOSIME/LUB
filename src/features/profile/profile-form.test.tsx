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
    const publicProfile = screen.getByRole("checkbox", { name: /السماح بظهور ملفي العام/ });
    fireEvent.click(publicProfile);
    fireEvent.submit(screen.getByRole("button", { name: "حفظ ومتابعة" }).closest("form")!);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("راجع الرقم"));
    expect((screen.getByLabelText("الاسم الكامل بالعربية") as HTMLInputElement).value).toBe("أحمد محمد");
    expect((screen.getByLabelText("الرقم الجامعي") as HTMLInputElement).value).toBe("invalid-number");
    expect(publicProfile.getAttribute("aria-checked")).toBe("true");
    expect((document.querySelector('input[name="publicProfileEnabled"]') as HTMLInputElement).checked).toBe(true);
    expect(screen.getByLabelText("الرقم الجامعي").getAttribute("aria-invalid")).toBe("true");
  });
  it("edits stored data without requesting the university number again", () => {
    render(<ProfileForm email="student@example.com" profile={{ fullName: "أحمد محمد", major: "نظم المعلومات", academicLevel: "5", phone: null, publicProfileEnabled: false, showTotalHours: true }} />);
    expect(screen.queryByLabelText("الرقم الجامعي")).toBeNull();
    expect(screen.getByRole("button", { name: "حفظ التعديلات" })).toBeTruthy();
    expect((screen.getByLabelText("التخصص") as HTMLInputElement).value).toBe("نظم المعلومات");
    expect(screen.getByLabelText(/رقم الهاتف/).getAttribute("dir")).toBe("ltr");
    const fields = document.querySelector(".account-settings-fields");
    expect(
      Array.from(fields?.querySelectorAll(":scope > [data-slot='field']") ?? []).map(
        (field) => field.querySelector("input, select")?.getAttribute("name")
      )
    ).toEqual(["fullName", "major", "academicLevel", "phone"]);
    expect(screen.queryByText("يُحفظ اختيارك لحين إتاحة الملفات العامة، وتبقى بياناتك الجامعية خاصة.")).toBeNull();
    expect(screen.queryByText("اعرض ساعاتك المعتمدة عند إتاحة ملفك العام.")).toBeNull();
    const footer = document.querySelector(".account-settings-footer");
    expect(footer?.firstElementChild?.matches("button")).toBe(true);
    expect(footer?.lastElementChild?.classList.contains("account-settings-footer-note")).toBe(true);
    expect(screen.queryByText("بياناتك محمية")).toBeNull();
    expect(screen.getByText("رقمك الجامعي وبريد حسابك لا يظهران للعامة.")).toBeTruthy();
    expect(
      screen.queryByText("رقمك الجامعي محفوظ بأمان ولا تحتاج إلى إدخاله مرة أخرى.")
    ).toBeNull();
    const email = screen.getByRole("group", { name: "البريد المتحقق منه" });
    const emailAddress = screen.getByText("student@example.com");
    const verified = screen.getByText("موثّق");
    expect(email.contains(emailAddress)).toBe(true);
    expect(emailAddress.closest(".account-settings-email-address")).not.toBeNull();
    expect(emailAddress.closest(".account-settings-email-address")?.contains(verified)).toBe(true);
  });
});
