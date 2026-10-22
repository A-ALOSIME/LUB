// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Input } from "@/components/ui/input";
import { OrganizationContactChannelEditor } from "./contact-channel-editor";
import { OrganizationInterestEditor } from "./organization-interest-editor";
import { OrganizationLeadershipVisibilityButton } from "./organization-leadership-switch";
import { MutationForm } from "./mutation-form";

const mockMutation = vi.hoisted(() => vi.fn(async (_previous: unknown, data: FormData) => {
  return { success: `Saved ${String(data.get("nameAr"))}` };
}));
vi.mock("./actions", () => ({ mutateOrganization: mockMutation }));

afterEach(cleanup);

describe("organization profile unsaved changes", () => {
  it("re-reads the saved leadership visibility correctly after a fresh profile load", async () => {
    let savedVisibility = true;
    mockMutation.mockImplementationOnce(async (_previous, data) => {
      savedVisibility = data.get("showLeadershipPublicly") === "on";
      return { success: "تم حفظ بيانات الجهة." };
    });
    const firstLoad = render(<MutationForm operation="org-profile" fields={{ organizationId: "org-1" }} submitLabel="حفظ" locale="ar" stickySaveBar>
      <OrganizationLeadershipVisibilityButton defaultChecked locale="ar" />
    </MutationForm>);

    fireEvent.click(screen.getByRole("button", { name: "قيادة الجهة: ظاهرة للعامة" }));
    expect(await screen.findByText("لديك تغييرات غير محفوظة")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "حفظ" }));
    await waitFor(() => expect(savedVisibility).toBe(false));
    await screen.findByRole("status");
    firstLoad.unmount();

    render(<MutationForm operation="org-profile" fields={{ organizationId: "org-1" }} submitLabel="حفظ" locale="ar" stickySaveBar>
      <OrganizationLeadershipVisibilityButton defaultChecked={savedVisibility} locale="ar" />
    </MutationForm>);

    expect(screen.getByRole("button", { name: "قيادة الجهة: مخفية" }).getAttribute("aria-pressed")).toBe("false");
    expect(document.querySelector<HTMLInputElement>('input[name="showLeadershipPublicly"]')?.value).toBe("");
  });

  it("loads the saved leadership state, submits a change, and restores that saved state after undo", async () => {
    const savedState = true;
    render(<MutationForm operation="org-profile" fields={{ organizationId: "org-1" }} submitLabel="حفظ" locale="ar" stickySaveBar>
      <OrganizationLeadershipVisibilityButton defaultChecked={savedState} locale="ar" />
    </MutationForm>);

    expect(screen.getByRole("button", { name: "قيادة الجهة: ظاهرة للعامة" }).getAttribute("aria-pressed")).toBe("true");
    const serialized = document.querySelector<HTMLInputElement>('input[name="showLeadershipPublicly"]')!;
    expect(serialized.value).toBe("on");

    fireEvent.click(screen.getByRole("button", { name: "قيادة الجهة: ظاهرة للعامة" }));
    const unsavedMessage = await screen.findByText("لديك تغييرات غير محفوظة");
    expect(unsavedMessage.classList.contains("workspace-sticky-save-message")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "حفظ" }));
    await waitFor(() => expect(mockMutation.mock.calls.at(-1)?.[1].get("showLeadershipPublicly")).toBe(""));
    await waitFor(() => expect(screen.queryByText("لديك تغييرات غير محفوظة")).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: "قيادة الجهة: مخفية" }));
    fireEvent.click(screen.getByRole("button", { name: "تراجع" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "قيادة الجهة: مخفية" }).getAttribute("aria-pressed")).toBe("false");
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
      expect(screen.getByRole("status").classList.contains("organization-profile-save-success")).toBe(true);
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
