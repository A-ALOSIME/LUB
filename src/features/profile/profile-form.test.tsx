// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const action = vi.hoisted(() => vi.fn());
vi.mock("./actions", () => ({ saveProfile: action }));
import { ProfileForm } from "./profile-form";
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("profile form interactions", () => {
  it("retains entries after server validation fails", async () => {
    action.mockResolvedValue({ error: "راجع الرقم الجامعي.", fieldErrors: { universityId: ["أدخل رقمًا صحيحًا."] } });
    render(<ProfileForm email="student@example.com" />);
    fireEvent.change(screen.getByLabelText("الاسم الكامل بالعربية"), { target: { value: "أحمد محمد" } });
    fireEvent.change(screen.getByLabelText("الرقم الجامعي"), { target: { value: "invalid-number" } });
    fireEvent.change(screen.getByLabelText("التخصص"), { target: { value: "نظم المعلومات" } });
    fireEvent.change(screen.getByLabelText("المستوى الدراسي"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "حفظ البيانات" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("راجع الرقم"));
    expect((screen.getByLabelText("الاسم الكامل بالعربية") as HTMLInputElement).value).toBe("أحمد محمد");
    expect((screen.getByLabelText("الرقم الجامعي") as HTMLInputElement).value).toBe("invalid-number");
    expect(screen.queryByLabelText(/السماح بظهور ملفي العام/)).toBeNull();
    expect(screen.getByLabelText("الرقم الجامعي").getAttribute("aria-invalid")).toBe("true");
  });
  it("edits stored data without requesting the university number again", () => {
    render(<ProfileForm email="student@example.com" profile={{ fullName: "أحمد محمد", major: "نظم المعلومات", academicLevel: "5", phone: null }} />);
    expect(screen.queryByLabelText("الرقم الجامعي")).toBeNull();
    const saveButton = screen.getByRole("button", { name: "حفظ التعديلات" });
    expect((saveButton as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByLabelText("التخصص") as HTMLInputElement).value).toBe("نظم المعلومات");
    fireEvent.change(screen.getByLabelText("التخصص"), { target: { value: "نظم المعلومات الإدارية" } });
    expect((screen.getByRole("button", { name: "حفظ التعديلات" }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByLabelText("التخصص") as HTMLInputElement).value).toBe("نظم المعلومات الإدارية");
    expect(screen.getByLabelText(/رقم الهاتف/).getAttribute("dir")).toBe("ltr");
    expect(screen.getByRole("combobox", { name: "رمز الدولة" })).toHaveProperty("value", "966");
    const fieldRows = Array.from(document.querySelectorAll(".account-settings-field-row"));
    expect(
      Array.from(fieldRows[0]?.querySelectorAll("[data-slot='field']") ?? []).map(
        (field) => field.querySelector("input, select")?.getAttribute("name")
      )
    ).toEqual(["fullName", "major"]);
    expect(
      Array.from(fieldRows[1]?.querySelectorAll("[data-slot='field']") ?? []).map(
        (field) => field.querySelector("input, select")?.getAttribute("name")
      )
    ).toEqual(["academicLevel", "phone"]);
    expect(fieldRows[1]?.querySelector(".account-settings-email")).toBeNull();
    expect(document.querySelector(".account-settings-divider")?.nextElementSibling?.classList.contains("account-settings-email")).toBe(true);
    expect(screen.queryByText("يُحفظ اختيارك لحين إتاحة الملفات العامة، وتبقى بياناتك الجامعية خاصة.")).toBeNull();
    expect(screen.queryByText("اعرض ساعاتك المعتمدة عند إتاحة ملفك العام.")).toBeNull();
    expect(document.querySelector(".account-settings-footer")).not.toBeNull();
    expect(document.querySelector(".account-settings-footer-note")?.closest("[data-slot='card']"))
      .not.toBe(document.querySelector(".account-settings-card"));
    expect(document.querySelector(".account-settings-privacy-title")?.textContent).toBe("الخصوصية");
    expect(document.querySelector(".workspace-sticky-save-bar")).toBeNull();
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
