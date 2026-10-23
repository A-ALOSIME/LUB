// @vitest-environment jsdom
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { FilterTabs } from "@/components/ui/filter-tabs";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", async importOriginal => ({ ...await importOriginal<typeof import("next/navigation")>(), useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/preferences", () => ({ getPreferences: async () => ({ locale: "ar", theme: "dark" }) }));
vi.mock("@/features/organizations/actions", () => ({ mutateOrganization: async () => ({ success: "Saved" }) }));
vi.mock("@/features/organizations/management-repository", () => ({ getManagementOrganization: vi.fn() }));
vi.mock("@/features/organizations/access", () => ({ loadManagementPageData: async () => ({ data: {
  organization: { id: "44444444-4444-4444-8444-444444444444", slug: "preview", nameAr: "جهة توضيحية للمعاينة", typeCode: "Club", summary: "وصف توضيحي لمجتمع طلابي يجمع الطلاب للمشاركة في الأنشطة وتطوير مهاراتهم عبر البرامج والفعاليات والمبادرات المشتركة.", mission: "تمكين الطلاب وتطوير مهاراتهم.", logoUrl: "", publicProfileContent: { vision: "مجتمع طلابي يصنع أثرًا", goals: "تطوير المهارات والعمل الجماعي" }, linksCustomized: true, showLeadershipPublicly: false, canEdit: true, canManageCommittees: true },
  committees: [
    { id: "a", name: "الفعاليات", description: "", isPublic: true, statusCode: "Active", parentCommitteeId: null, canEdit: true, memberCount: 0, leaderName: null },
    { id: "b", name: "المحتوى", description: "", isPublic: true, statusCode: "Active", parentCommitteeId: "a", canEdit: true, memberCount: 0, leaderName: null },
    { id: "c", name: "ميديا", description: "", isPublic: true, statusCode: "Active", parentCommitteeId: "a", canEdit: true, memberCount: 0, leaderName: null },
    { id: "d", name: "الأنشطة", description: "", isPublic: true, statusCode: "Active", parentCommitteeId: null, canEdit: true, memberCount: 0, leaderName: null },
  ], contacts: [{ linkType: "Phone", url: "tel:+966506502858" }, { linkType: "Email", url: "mailto:team@example.edu" }, { linkType: "Website", url: "https://example.com" }], tagNames: ["تقنية"],
} }) }));
import Page from "./page";

afterEach(() => { cleanup(); window.history.replaceState(null, "", "/"); });

it("separates profile tasks into tabs while retaining every section in the shared save form", async () => {
  window.history.replaceState(null, "", "/manage/organizations/44444444-4444-4444-8444-444444444444");
  const { container } = render(<div className="organization-management-page workspace-route-content">
    {await Page({ params: Promise.resolve({ id: "44444444-4444-4444-8444-444444444444" }), searchParams: Promise.resolve({}) })}
    <FilterTabs value="all" options={[{ value: "all", label: "الكل" }, { value: "active", label: "نشطة" }, { value: "ended", label: "منتهية" }]} ariaLabel="تصفية الأعضاء" onValueChange={() => {}} />
  </div>);
  const name = screen.getByRole("textbox", { name: "اسم الجهة" });
  fireEvent.change(name, { target: { value: "تعديل غير محفوظ" } });
  const form = name.closest("form")!;
  function capture(section: string) {
    if (!process.env.LUB_VISUAL_DIR) return;
    mkdirSync(process.env.LUB_VISUAL_DIR, { recursive: true });
    writeFileSync(join(process.env.LUB_VISUAL_DIR, `${section}.html`), container.innerHTML);
  }
  capture("about");
  fireEvent.click(screen.getByRole("tab", { name: "المحتوى والإنجازات" }));
  const departure = await screen.findByRole("alertdialog");
  fireEvent.click(within(departure).getByRole("button", { name: /^حفظ$/ }));
  await waitFor(() => expect(screen.getByRole("textbox", { name: "رؤيتنا" })).toBeTruthy());
  expect(screen.getByRole("textbox", { name: "رؤيتنا" })).toBeTruthy();
  expect(new FormData(form).get("nameAr")).toBe("تعديل غير محفوظ");
  expect(new FormData(form).get("publicProfileContent")).toContain("مجتمع طلابي");
  capture("profile");
  fireEvent.click(screen.getByRole("tab", { name: "التواصل والنشر" }));
  expect(screen.getByRole("button", { name: "إضافة قناة" })).toBeTruthy();
  expect(new FormData(form).get("contacts")).toContain("+966506502858");
  expect(new FormData(form).get("nameAr")).toBe("تعديل غير محفوظ");
  capture("contacts");
  fireEvent.click(screen.getByRole("tab", { name: "اللجان" }));
  expect(screen.getByRole("button", { name: "طي الفعاليات" })).toBeTruthy();
  capture("committees");
  fireEvent.click(screen.getByRole("tab", { name: "الأساسية" }));
  expect(screen.getByRole("textbox", { name: "اسم الجهة" })).toHaveProperty("value", "تعديل غير محفوظ");
});
