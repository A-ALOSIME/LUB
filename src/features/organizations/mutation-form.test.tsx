// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Input } from "@/components/ui/input";
import { OrganizationContactChannelEditor } from "./contact-channel-editor";
import { OrganizationInterestEditor } from "./organization-interest-editor";
import { OrganizationLeadershipVisibilityButton } from "./organization-leadership-switch";
import { MutationForm } from "./mutation-form";
import { OrganizationSectionTabPanel, OrganizationSectionTabs } from "./organization-section-tabs";

const mockMutation = vi.hoisted(() => vi.fn(async (_previous: unknown, data: FormData): Promise<{ success?: string; error?: string }> => {
  return { success: `Saved ${String(data.get("nameAr"))}` };
}));
vi.mock("./actions", () => ({ mutateOrganization: mockMutation }));
const toastAdd = vi.hoisted(() => vi.fn());
vi.mock("@/components/ui/toast", () => ({ toast: { add: toastAdd } }));

afterEach(cleanup);

describe("organization profile unsaved changes", () => {
  it("retains edits and the save bar when a save fails, and reports a persistent error toast", async () => {
    let finish: ((state: { error: string }) => void) | undefined;
    mockMutation.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    render(<MutationForm operation="org-profile" submitLabel="حفظ" locale="ar" stickySaveBar><Input name="nameAr" aria-label="اسم الجهة" defaultValue="نادي التقنية" /></MutationForm>);
    fireEvent.change(screen.getByRole("textbox", { name: "اسم الجهة" }), { target: { value: "تعديل لا يضيع" } });
    fireEvent.click(screen.getByRole("button", { name: "حفظ" }));
    expect(await screen.findByRole("button", { name: "جاري الحفظ" })).toHaveProperty("disabled", true);
    finish?.({ error: "تعذّر الحفظ. حاول مرة ثانية." });
    await screen.findByRole("alert");
    expect(screen.getByRole("textbox", { name: "اسم الجهة" })).toHaveProperty("value", "تعديل لا يضيع");
    expect(screen.getByText("لديك تغييرات غير محفوظة")).toBeTruthy();
    expect(toastAdd).toHaveBeenCalledWith({ title: "تعذّر الحفظ. حاول مرة ثانية.", type: "error", timeout: 0 });
  });

  it("offers stay and discard before changing tabs, and discard restores the saved form", async () => {
    render(<OrganizationSectionTabs items={[{ id: "about", label: "الأساسية" }, { id: "contacts", label: "التواصل" }]} initialSection="about" label="الجهة" dir="rtl">
      <MutationForm operation="org-profile" submitLabel="حفظ" stickySaveBar><OrganizationSectionTabPanel id="about"><Input name="nameAr" aria-label="اسم الجهة" defaultValue="نادي التقنية" /></OrganizationSectionTabPanel><OrganizationSectionTabPanel id="contacts"><p>قنوات الجهة</p></OrganizationSectionTabPanel></MutationForm>
    </OrganizationSectionTabs>);
    fireEvent.change(screen.getByRole("textbox", { name: "اسم الجهة" }), { target: { value: "مؤقت" } });
    fireEvent.click(screen.getByRole("tab", { name: "التواصل" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "البقاء" }));
    expect(screen.getByRole("tab", { name: "الأساسية" }).getAttribute("aria-selected")).toBe("true");
    fireEvent.click(screen.getByRole("tab", { name: "التواصل" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "تجاهل التغييرات" }));
    await waitFor(() => expect(screen.getByRole("tab", { name: "التواصل" }).getAttribute("aria-selected")).toBe("true"));
    fireEvent.click(screen.getByRole("tab", { name: "الأساسية" }));
    expect(screen.getByRole("textbox", { name: "اسم الجهة" })).toHaveProperty("value", "نادي التقنية");
  });
  it("keeps edits in hidden sections and submits the whole profile together", async () => {
    render(<OrganizationSectionTabs items={[{ id: "about", label: "الأساسية" }, { id: "contacts", label: "التواصل" }]} initialSection="about" label="بيانات الجهة" dir="rtl">
      <MutationForm operation="org-profile" submitLabel="حفظ" locale="ar" stickySaveBar>
        <OrganizationSectionTabPanel id="about"><Input name="nameAr" aria-label="اسم الجهة" defaultValue="نادي التقنية" /></OrganizationSectionTabPanel>
        <OrganizationSectionTabPanel id="contacts"><Input name="websiteUrl" aria-label="رابط الموقع" defaultValue="https://example.com" /></OrganizationSectionTabPanel>
      </MutationForm>
    </OrganizationSectionTabs>);
    fireEvent.change(screen.getByRole("textbox", { name: "اسم الجهة" }), { target: { value: "نادي الأمن" } });
    fireEvent.click(screen.getByRole("tab", { name: "التواصل" }));
    const departureDialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(departureDialog).getByRole("button", { name: /^حفظ$/ }));
    await screen.findByRole("textbox", { name: "رابط الموقع" });
    fireEvent.change(screen.getByRole("textbox", { name: "رابط الموقع" }), { target: { value: "https://example.edu" } });
    fireEvent.click(screen.getByRole("button", { name: "حفظ" }));
    await waitFor(() => {
      const submitted = mockMutation.mock.calls.at(-1)?.[1];
      expect(submitted?.get("nameAr")).toBe("نادي الأمن");
      expect(submitted?.get("websiteUrl")).toBe("https://example.edu");
    });
  });

  it("protects dirty forms from link navigation and reload, then clears the guard on undo", async () => {
      render(<><a href="/another-workspace">مساحة أخرى</a><MutationForm operation="org-profile" submitLabel="حفظ" locale="ar" stickySaveBar>
        <Input name="nameAr" aria-label="اسم الجهة" defaultValue="نادي التقنية" />
      </MutationForm></>);
      fireEvent.change(screen.getByRole("textbox", { name: "اسم الجهة" }), { target: { value: "نادي الأمن" } });
      await screen.findByText("لديك تغييرات غير محفوظة");
      expect(fireEvent.click(screen.getByRole("link", { name: "مساحة أخرى" }))).toBe(false);
      const dialog = await screen.findByRole("alertdialog");
      expect(within(dialog).getByRole("button", { name: /^حفظ$/ })).toBeTruthy();
      expect(within(dialog).getByRole("button", { name: "تجاهل التغييرات" })).toBeTruthy();
      fireEvent.click(within(dialog).getByRole("button", { name: "البقاء" }));
      const unload = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(unload);
      expect(unload.defaultPrevented).toBe(true);
      fireEvent.click(screen.getByRole("button", { name: "تراجع" }));
      const cleanUnload = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(cleanUnload);
      expect(cleanUnload.defaultPrevented).toBe(false);
  });

  it("re-reads the saved leadership visibility correctly after a fresh profile load", async () => {
    let savedVisibility = true;
    mockMutation.mockImplementationOnce(async (_previous, data) => {
      savedVisibility = data.get("showLeadershipPublicly") === "on";
      return { success: "تم حفظ بيانات الجهة." };
    });
    const firstLoad = render(<MutationForm operation="org-profile" fields={{ organizationId: "org-1" }} submitLabel="حفظ" locale="ar" stickySaveBar>
      <OrganizationLeadershipVisibilityButton defaultChecked locale="ar" />
    </MutationForm>);

    fireEvent.click(screen.getByRole("switch", { name: "إظهار قيادة الجهة في الصفحة العامة" }));
    expect(await screen.findByText("لديك تغييرات غير محفوظة")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "حفظ" }));
    await waitFor(() => expect(savedVisibility).toBe(false));
    await waitFor(() => expect(screen.queryByText("لديك تغييرات غير محفوظة")).toBeNull());
    firstLoad.unmount();

    render(<MutationForm operation="org-profile" fields={{ organizationId: "org-1" }} submitLabel="حفظ" locale="ar" stickySaveBar>
      <OrganizationLeadershipVisibilityButton defaultChecked={savedVisibility} locale="ar" />
    </MutationForm>);

    expect(screen.getByRole("switch", { name: "إظهار قيادة الجهة في الصفحة العامة" }).getAttribute("aria-checked")).toBe("false");
    expect(document.querySelector<HTMLInputElement>('input[name="showLeadershipPublicly"]')?.value).toBe("");
  });

  it("loads the saved leadership state, submits a change, and restores that saved state after undo", async () => {
    const savedState = true;
    render(<MutationForm operation="org-profile" fields={{ organizationId: "org-1" }} submitLabel="حفظ" locale="ar" stickySaveBar>
      <OrganizationLeadershipVisibilityButton defaultChecked={savedState} locale="ar" />
    </MutationForm>);

    expect(screen.getByRole("switch", { name: "إظهار قيادة الجهة في الصفحة العامة" }).getAttribute("aria-checked")).toBe("true");
    const serialized = document.querySelector<HTMLInputElement>('input[name="showLeadershipPublicly"]')!;
    expect(serialized.value).toBe("on");

    fireEvent.click(screen.getByRole("switch", { name: "إظهار قيادة الجهة في الصفحة العامة" }));
    const unsavedMessage = await screen.findByText("لديك تغييرات غير محفوظة");
    expect(unsavedMessage.classList.contains("workspace-sticky-save-message")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "حفظ" }));
    await waitFor(() => expect(mockMutation.mock.calls.at(-1)?.[1].get("showLeadershipPublicly")).toBe(""));
    await waitFor(() => expect(screen.queryByText("لديك تغييرات غير محفوظة")).toBeNull());

    fireEvent.click(screen.getByRole("switch", { name: "إظهار قيادة الجهة في الصفحة العامة" }));
    fireEvent.click(screen.getByRole("button", { name: "تراجع" }));
    await waitFor(() => {
      expect(screen.getByRole("switch", { name: "إظهار قيادة الجهة في الصفحة العامة" }).getAttribute("aria-checked")).toBe("false");
      expect(serialized.value).toBe("");
    });
  });

  it("shows the fixed save actions only for changed form data and undo restores controlled editors", async () => {
    render(<MutationForm operation="org-profile" fields={{ organizationId: "org-1" }} submitLabel="حفظ" locale="ar" stickySaveBar>
      <Input name="nameAr" aria-label="اسم الجهة" defaultValue="نادي التقنية" />
      <OrganizationInterestEditor initialInterests={["تقنية"]} locale="ar" />
      <OrganizationContactChannelEditor initialChannels={[]} locale="ar" />
    </MutationForm>);

    expect(screen.queryByText("لديك تغييرات غير محفوظة")).toBeNull();
    fireEvent.change(screen.getByRole("textbox", { name: "اسم الجهة" }), { target: { value: "نادي الأمن" } });
    fireEvent.click(screen.getByRole("button", { name: "إضافة قناة" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "البريد" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(screen.getByRole("textbox", { name: "البريد" }), { target: { value: "team@example.edu" } });
    fireEvent.submit(dialog.querySelector("form")!);
    expect(await screen.findByText("لديك تغييرات غير محفوظة")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "تراجع" }));

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "اسم الجهة" })).toHaveProperty("value", "نادي التقنية");
      expect(document.querySelector<HTMLInputElement>('input[name="tagNames"]')?.value).toBe("تقنية");
      expect(document.querySelector<HTMLInputElement>('input[name="contacts"]')?.value).toBe("[]");
      expect(screen.queryByText("لديك تغييرات غير محفوظة")).toBeNull();
    });
  });

  it("submits current editor values and shows a small save confirmation", async () => {
    render(<MutationForm operation="org-profile" fields={{ organizationId: "org-1" }} submitLabel="حفظ" locale="ar" stickySaveBar>
      <Input name="nameAr" aria-label="اسم الجهة" defaultValue="نادي التقنية" />
      <OrganizationInterestEditor initialInterests={["تقنية"]} locale="ar" />
      <OrganizationContactChannelEditor initialChannels={[]} locale="ar" />
    </MutationForm>);
    const name = screen.getByRole("textbox", { name: "اسم الجهة" });
    fireEvent.change(name, { target: { value: "نادي الأمن" } });
    fireEvent.change(screen.getByRole("textbox", { name: "مجال اهتمام جديد" }), { target: { value: "أمن سيبراني" } });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "مجال اهتمام جديد" }), { key: "Enter", code: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "إضافة قناة" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "البريد" }));
    const channelDialog = await screen.findByRole("dialog");
    fireEvent.change(screen.getByRole("textbox", { name: "البريد" }), { target: { value: "team@example.edu" } });
    fireEvent.submit(channelDialog.querySelector("form")!);

    expect(await screen.findByText("لديك تغييرات غير محفوظة")).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: "حفظ" }));

    await waitFor(() => {
      expect(mockMutation).toHaveBeenCalled();
      expect(toastAdd).toHaveBeenCalledWith({ title: "تم الحفظ", type: "success", timeout: 3000 });
      expect(screen.queryByText("لديك تغييرات غير محفوظة")).toBeNull();
    });
    const submitted = mockMutation.mock.calls.at(-1)?.[1];
    expect(submitted?.get("nameAr")).toBe("نادي الأمن");
    expect(submitted?.get("tagNames")).toBe("تقنية,أمن سيبراني");
    expect(submitted?.get("organizationId")).toBe("org-1");
    expect(submitted?.get("contacts")).toBe(JSON.stringify([{ kind: "Email", value: "team@example.edu" }]));

    fireEvent.change(name, { target: { value: "اسم مؤقت" } });
    expect(await screen.findByText("لديك تغييرات غير محفوظة")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "تراجع" }));
    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "اسم الجهة" })).toHaveProperty("value", "نادي الأمن");
      expect(document.querySelector<HTMLInputElement>('input[name="tagNames"]')?.value).toBe("تقنية,أمن سيبراني");
      expect(document.querySelector<HTMLInputElement>('input[name="contacts"]')?.value).toBe(JSON.stringify([{ kind: "Email", value: "team@example.edu" }]));
    });
  });
});
