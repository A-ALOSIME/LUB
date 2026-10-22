// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkspaceSidebarLayout, WorkspaceSidebarTrigger } from "./workspace-sidebar-layout";
import { MyPageNavigation } from "./my-page-navigation";

const pathname = vi.hoisted(() => ({ value: "/me" }));

vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));
vi.mock("@/features/auth/actions", () => ({ signOut: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({ href, children, prefetch, onClick, ...props }: { href: string; children: ReactNode; prefetch?: boolean; onClick?: React.MouseEventHandler<HTMLAnchorElement> }) => <a href={href} data-prefetch={prefetch === false ? "disabled" : "enabled"} {...props} onClick={event => { event.preventDefault(); onClick?.(event); }}>{children}</a>,
}));

function workspaceView(navigation: ReactNode) {
  return <WorkspaceSidebarLayout header={<div />} navigation={navigation}><main /></WorkspaceSidebarLayout>;
}

function renderNavigation(navigation: ReactNode) {
  return render(workspaceView(navigation));
}

afterEach(() => {
  cleanup();
  pathname.value = "/me";
});

const organization = (overrides: Partial<{
  id: string; nameAr: string; statusCode: string; pendingApplications: number;
  canEdit: boolean; canManageCommittees: boolean; canApplications: boolean; canEvents: boolean;
  canReports: boolean; canHours: boolean; canRenewals: boolean; canTasks: boolean;
  canMembers: boolean; canGrant: boolean;
}> = {}) => ({
  id: "org-1", nameAr: "نادي الأمن السيبراني", statusCode: "Active", pendingApplications: 2,
  canEdit: true, canManageCommittees: true, canApplications: true, canEvents: true,
  canReports: true, canHours: true, canRenewals: true, canTasks: true, canMembers: true, canGrant: true,
  ...overrides,
});

describe("workspace sidebar", () => {
  it("shows the requested account destinations and highlights only the current route", () => {
    pathname.value = "/account/talent";
    renderNavigation(<MyPageNavigation locale="ar" organizations={[]} userName="أحمد" />);

    expect(screen.queryByText("مساحة موحدة")).toBeNull();
    expect(screen.getByRole("link", { name: "نظرة عامة" }).getAttribute("href")).toBe("/me");
    expect(screen.getByRole("link", { name: "ملفي المهاري" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "بيانات الحساب" }).getAttribute("aria-current")).toBeNull();
    expect(screen.getByRole("link", { name: "طلباتي" }).getAttribute("href")).toBe("/applications");
    expect(screen.getByRole("link", { name: "نشاطي" }).getAttribute("href")).toBe("/activity");
    expect(screen.getByRole("region", { name: "حسابي" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "إدارة الجهات" })).toBeNull();
    expect(screen.getByRole("button", { name: "قائمة حساب أحمد" }).querySelector('[data-slot="avatar-fallback"]')?.textContent).toBe("أ");
  });

  it("keeps the full LUB logo visible in account workspace routes", () => {
    pathname.value = "/account";
    renderNavigation(<MyPageNavigation locale="ar" organizations={[]} userName="أحمد" />);

    const brand = screen.getByRole("link", { name: "لُبّ، الرئيسية" });
    expect(brand.querySelectorAll("img")).toHaveLength(2);
  });

  it("keeps one organization as a plain name and lists seven compact management destinations", () => {
    pathname.value = "/manage/organizations/org-1/events";
    renderNavigation(<MyPageNavigation locale="ar" organizations={[organization()]} userName="أحمد" />);

    const management = screen.getByRole("region", { name: "إدارة الجهات" });
    const expected = ["الجهة", "الأعضاء", "التسجيل والتجديد", "الفعاليات والإعلانات", "المهام والساعات"];
    const links = within(management).getAllByRole("link");
    expect(links.map(link => link.querySelector<HTMLElement>("[data-sidebar-label]")?.dataset.sidebarLabel).filter(label => expected.includes(label ?? ""))).toEqual(expected);
    expect(screen.queryByRole("button", { name: /اختيار الجهة/ })).toBeNull();
    expect(screen.getByText("نادي الأمن السيبراني")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "نادي الأمن السيبراني" })).toBeNull();
    expect(screen.getByRole("link", { name: "الفعاليات والإعلانات" }).getAttribute("aria-current")).toBe("page");
    expect(management.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
    expect(within(management).queryByRole("link", { name: /طلبات الأعضاء/ })).toBeNull();
    expect(within(management).getByRole("link", { name: /الأعضاء/ }).querySelector("[data-pending-count]")?.textContent).toBe("2");
    expect(within(management).queryByRole("link", { name: "اللجان" })).toBeNull();
    expect(within(management).queryByRole("link", { name: "الأدوار والتفويضات" })).toBeNull();
    expect(within(management).queryByRole("link", { name: "التقارير والمستندات" })).toBeNull();
    expect(screen.getByText("2", { selector: "[data-pending-count]" })).toBeTruthy();
    expect(screen.queryByText("نشطة")).toBeNull();
  });

  it("allows the account and organization sections to stay open together", () => {
    pathname.value = "/manage/organizations/org-1/events";
    renderNavigation(<MyPageNavigation locale="ar" organizations={[organization()]} userName="أحمد" />);

    const accountHeading = screen.getByRole("button", { name: "حسابي" });
    const managementHeading = screen.getByRole("button", { name: "إدارة الجهات" });
    expect(managementHeading.getAttribute("aria-expanded")).toBe("true");
    expect(accountHeading.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(accountHeading);
    expect(accountHeading.getAttribute("aria-expanded")).toBe("true");
    expect(managementHeading.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("link", { name: "بيانات الحساب" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "الجهة" })).toBeTruthy();

    fireEvent.click(managementHeading);
    expect(accountHeading.getAttribute("aria-expanded")).toBe("true");
    expect(managementHeading.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByRole("link", { name: "ملفي المهاري" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "الجهة" })).toBeNull();
  });

  it("preserves independently open sections while navigating between workspaces", () => {
    pathname.value = "/manage/organizations/org-1/events";
    const { rerender } = renderNavigation(<MyPageNavigation locale="ar" organizations={[organization()]} userName="أحمد" />);
    const accountHeading = screen.getByRole("button", { name: "حسابي" });
    const managementHeading = screen.getByRole("button", { name: "إدارة الجهات" });

    fireEvent.click(accountHeading);
    pathname.value = "/account/talent";
    rerender(workspaceView(<MyPageNavigation locale="ar" organizations={[organization()]} userName="أحمد" />));
    expect(accountHeading.getAttribute("aria-expanded")).toBe("true");
    expect(managementHeading.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(managementHeading);
    fireEvent.click(managementHeading);

    pathname.value = "/manage/organizations/org-1/events";
    rerender(workspaceView(<MyPageNavigation locale="ar" organizations={[organization()]} userName="أحمد" />));
    expect(accountHeading.getAttribute("aria-expanded")).toBe("true");
    expect(managementHeading.getAttribute("aria-expanded")).toBe("true");
  });

  it("uses an Arabic organization initial without the definite article", () => {
    pathname.value = "/manage/organizations/org-1/events";
    renderNavigation(<MyPageNavigation locale="ar" organizations={[organization({ nameAr: "المجلس الاستشاري الطلابي لنظم المعلومات" })]} userName="أحمد" />);

    expect(document.querySelector(".workspace-sidebar-organization-mark")?.textContent).toBe("م");
  });

  it("offers a selector for multiple managed organizations and filters links by permission", () => {
    pathname.value = "/manage/organizations/org-2/events";
    renderNavigation(<MyPageNavigation locale="ar" organizations={[
      organization({ canEdit: false, canManageCommittees: false, canApplications: false, canEvents: true, canReports: false, canHours: false, canRenewals: false, canTasks: false, canMembers: false, canGrant: false }),
      organization({ id: "org-2", nameAr: "مجلس التقنية", canApplications: false, canRenewals: false, canTasks: false }),
    ]} userName="أحمد" />);

    const selector = screen.getByRole("button", { name: /اختيار الجهة/ });
    fireEvent.click(selector);
    expect(screen.getByRole("menuitem", { name: "مجلس التقنية" })).toBeTruthy();
    const management = screen.getByRole("region", { name: "إدارة الجهات" });
    expect(within(management).getByRole("link", { name: "الفعاليات والإعلانات" })).toBeTruthy();
    expect(within(management).queryByRole("link", { name: "طلبات الأعضاء" })).toBeNull();
    expect(within(management).queryByRole("link", { name: "المهام" })).toBeNull();
  });

  it("merges the member applications route into the members destination", () => {
    pathname.value = "/manage/organizations/org-1/applications/application-1";
    renderNavigation(<MyPageNavigation locale="ar" organizations={[organization()]} userName="أحمد" />);

    expect(screen.getByRole("link", { name: /الأعضاء/ }).getAttribute("aria-current")).toBe("page");
    expect(screen.queryByRole("link", { name: "طلبات الأعضاء" })).toBeNull();
    expect(screen.getByRole("link", { name: "نظرة عامة" }).getAttribute("aria-current")).toBeNull();
  });

  it("highlights the merged members and hours destinations on their legacy routes", () => {
    pathname.value = "/manage/organizations/org-1/permissions";
    const { rerender } = renderNavigation(<MyPageNavigation locale="ar" organizations={[organization()]} userName="أحمد" />);
    let management = screen.getByRole("region", { name: "إدارة الجهات" });
    expect(within(management).getByRole("link", { name: /الأعضاء/ }).getAttribute("aria-current")).toBe("page");
    expect(management.querySelectorAll('[aria-current="page"]')).toHaveLength(1);

    pathname.value = "/manage/organizations/org-1/hours";
    rerender(workspaceView(<MyPageNavigation locale="ar" organizations={[organization()]} userName="أحمد" />));
    management = screen.getByRole("region", { name: "إدارة الجهات" });
    expect(within(management).getByRole("link", { name: "المهام والساعات" }).getAttribute("aria-current")).toBe("page");
    expect(management.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
  });

  it("preserves system administration destinations for super administrators", () => {
    pathname.value = "/manage/organizations";
    renderNavigation(<MyPageNavigation locale="ar" organizations={[]} superAdmin userName="أحمد" />);

    expect(screen.getByRole("link", { name: "نظرة عامة" }).getAttribute("href")).toBe("/manage");
    expect(screen.getByRole("link", { name: "الجهات" }).getAttribute("href")).toBe("/manage/organizations");
    expect(screen.getByRole("link", { name: "المشرفون العامون" }).getAttribute("href")).toBe("/manage/admins");
    expect(screen.getByRole("link", { name: "الفصول الأكاديمية" }).getAttribute("href")).toBe("/manage/terms");
    expect(screen.queryByRole("heading", { name: "إدارة الجهات" })).toBeNull();
    expect(screen.getByRole("region", { name: "حسابي" })).toBeTruthy();
  });

  it("closes the shadcn mobile sidebar after choosing a real workspace route", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockImplementation(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    });
    pathname.value = "/me";
    render(<WorkspaceSidebarLayout
      header={<WorkspaceSidebarTrigger locale="ar" />}
      navigation={<MyPageNavigation locale="ar" organizations={[]} userName="أحمد" />}
    ><main /></WorkspaceSidebarLayout>);

    fireEvent.click(screen.getByRole("button", { name: "فتح القائمة" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("link", { name: "بيانات الحساب" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
