// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor,within } from "@testing-library/react";
const action = vi.hoisted(() => vi.fn());
vi.mock("./security-actions",()=>({changeAccountEmail:vi.fn(),changeAccountPassword:vi.fn()}));
vi.mock("next/navigation",()=>({useRouter:()=>({refresh:vi.fn()})}));
vi.mock("./actions", () => ({ saveProfile: action }));
import { ProfileForm } from "./profile-form";
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("profile form interactions", () => {
  it('keeps the account save bar unchanged when typing inside the separate email-change dialog',async()=>{
    render(<ProfileForm email="student@example.com" profile={{fullName:'طالب تجريبي',major:'نظم معلومات',academicLevel:'5',phone:null,universityId:'202699999',nationalId:'1000000008'}}/>);
    fireEvent.click(screen.getByRole('button',{name:'تغيير البريد'}));
    const dialog=await screen.findByRole('dialog');fireEvent.change(within(dialog).getByRole('textbox',{name:'البريد الإلكتروني الجديد'}),{target:{value:'other@example.invalid'}});
    expect(screen.queryByText('لديك تغييرات غير محفوظة')).toBeNull();
  });
  it("retains entries after server validation fails", async () => {
    action.mockResolvedValue({ error: "راجع الرقم الجامعي.", fieldErrors: { universityId: ["أدخل رقمًا صحيحًا."] } });
    render(<ProfileForm email="student@example.com" />);
    fireEvent.change(screen.getByLabelText("الاسم الكامل بالعربية"), { target: { value: "أحمد محمد" } });
    fireEvent.change(screen.getByLabelText("الرقم الجامعي"), { target: { value: "invalid-number" } });
    fireEvent.change(screen.getByLabelText("رقم الهوية الوطنية أو الإقامة"),{target:{value:"1000000008"}});
    fireEvent.click(screen.getByRole('combobox',{name:'التخصص'}));const majorOption=await screen.findByRole('option',{name:'نظم معلومات'});fireEvent.pointerDown(majorOption);fireEvent.click(majorOption);
    fireEvent.click(screen.getByRole("combobox",{name:"المستوى الدراسي"}));
    const option=await screen.findByRole("option",{name:"المستوى الخامس"});fireEvent.pointerDown(option);fireEvent.click(option);
    fireEvent.click(screen.getByRole("button", { name: "حفظ البيانات" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("راجع الرقم"));
    expect((screen.getByLabelText("الاسم الكامل بالعربية") as HTMLInputElement).value).toBe("أحمد محمد");
    expect((screen.getByLabelText("الرقم الجامعي") as HTMLInputElement).value).toBe("invalid-number");
    expect(screen.queryByLabelText(/السماح بظهور ملفي العام/)).toBeNull();
    expect(screen.getByLabelText("الرقم الجامعي").getAttribute("aria-invalid")).toBe("true");
  });
  it("edits stored identifiers and restricts majors to the approved choices", async () => {
    render(<ProfileForm email="student@example.com" profile={{ universityId:"202612345",nationalId:"1000000008",fullName: "أحمد محمد", major: "نظم المعلومات", academicLevel: "5", phone: null }} />);
    expect((screen.getByLabelText("الرقم الجامعي") as HTMLInputElement).value).toBe("202612345");
    const saveButton = screen.getByRole("button", { name: "حفظ التعديلات" });
    expect((saveButton as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByRole("combobox",{name:"التخصص"}).textContent).toContain("نظم معلومات");
    fireEvent.click(screen.getByRole("combobox",{name:"التخصص"}));const option=await screen.findByRole("option",{name:"علوم حاسب"});fireEvent.pointerDown(option);fireEvent.click(option);
    expect((screen.getByRole("button", { name: "حفظ التعديلات" }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByRole("combobox",{name:"التخصص"}).textContent).toContain("علوم حاسب");
    expect(screen.getByLabelText(/رقم الهاتف/).getAttribute("dir")).toBe("ltr");
    expect(screen.getByRole("combobox", { name: "رمز الدولة" }).textContent).toContain("+966");
    const fieldRows = Array.from(document.querySelectorAll(".account-settings-field-row"));
    expect(
      Array.from(fieldRows[0]?.querySelectorAll("[data-slot='field']") ?? []).map(
        (field) => field.querySelector("input, select")?.getAttribute("name")
      )
    ).toEqual(["fullName", "major"]);
    expect(
      Array.from(fieldRows[2]?.querySelectorAll("[data-slot='field']") ?? []).map(
        (field) => field.querySelector("input, select")?.getAttribute("name")
      )
    ).toEqual(["academicLevel", "phone"]);
    expect(fieldRows[2]?.querySelector(".account-settings-email")).toBeNull();
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
