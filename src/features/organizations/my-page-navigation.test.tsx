// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MyPageNavigation } from "./my-page-navigation";

vi.mock("next/link", () => ({
  default: ({ href, children, prefetch, ...props }: { href: string; children: ReactNode; prefetch?: boolean }) => <a href={href} data-prefetch={prefetch === false ? "disabled" : "enabled"} {...props}>{children}</a>,
}));

afterEach(cleanup);

describe("my page navigation", () => {
  it("shows account and organization management destinations together without a management landing link", () => {
    render(<MyPageNavigation locale="ar" organizations={[
      {
        id: "org-1",
        nameAr: "نادي الأمن السيبراني",
        statusCode: "Active",
        canEdit: true,
        canManageCommittees: true,
        canApplications: true,
        canEvents: true,
        canReports: true,
        canHours: true,
        canRenewals: true,
        canTasks: true,
        canMembers: true,
        canGrant: true,
      },
    ]} />);

    expect(screen.getByRole("complementary", { name: "تنقل مساحتي" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "عضوياتي وسجل أدواري" }).getAttribute("href")).toBe("#memberships");
    expect(screen.getByRole("link", { name: "نادي الأمن السيبراني" }).getAttribute("href")).toBe("/manage/organizations/org-1");
    expect(screen.getByRole("link", { name: "بيانات الجهة" }).getAttribute("href")).toBe("/manage/organizations/org-1");
    expect(screen.queryByRole("link", { name: "إعلانات الجهة" })).toBeNull();
    expect(screen.getByRole("link", { name: "اللجان" }).getAttribute("href")).toBe("/manage/organizations/org-1#committees");
    expect(screen.getByRole("link", { name: "طلبات الأعضاء" }).getAttribute("href")).toBe("/manage/organizations/org-1/applications");
    expect(screen.getByRole("link", { name: "فعاليات الجهة" }).getAttribute("href")).toBe("/manage/organizations/org-1/events");
    expect(screen.getByRole("link", { name: "قاعدة الأعضاء" }).getAttribute("href")).toBe("/manage/organizations/org-1/members");
    expect(screen.getByRole("link", { name: "الأدوار والتفويضات" }).getAttribute("href")).toBe("/manage/organizations/org-1/permissions");
    expect(screen.getByRole("link", { name: "الساعات" }).getAttribute("href")).toBe("/manage/organizations/org-1/hours");
    expect(screen.getByRole("link", { name: "تجديد العضوية" }).getAttribute("href")).toBe("/manage/organizations/org-1/renewals");
    expect(screen.getByRole("link", { name: "المهام والقوالب" }).getAttribute("href")).toBe("/manage/organizations/org-1/tasks");
    expect(screen.getByRole("link", { name: "بيانات الحساب" }).getAttribute("href")).toBe("/account");
    expect(screen.queryByRole("link", { name: "إدارة الجهات" })).toBeNull();
    expect(screen.queryByRole("link", { name: "إدارتي" })).toBeNull();
    expect(screen.queryByRole("link", { name: "صفحتي" })).toBeNull();
    expect(screen.queryByRole("link", { name: /تصفح الجهات|استكشف الأندية/ })).toBeNull();
    expect(screen.getAllByRole("link").every(link => link.getAttribute("data-prefetch") === "disabled")).toBe(true);
  });

  it("keeps account navigation available when the member has no organization permissions", () => {
    render(<MyPageNavigation locale="ar" organizations={[]} />);

    expect(screen.getByRole("link", { name: "بيانات الحساب" }).getAttribute("href")).toBe("/account");
    expect(screen.queryByRole("heading", { name: "إدارة الجهات" })).toBeNull();
    expect(screen.queryByRole("link", { name: /تصفح الجهات|استكشف الأندية/ })).toBeNull();
  });

  it("only lists management destinations the organization access grants", () => {
    render(<MyPageNavigation locale="ar" organizations={[{
      id: "org-2",
      nameAr: "مجلس التقنية",
      statusCode: "Active",
      canEdit: false,
      canManageCommittees: false,
      canApplications: false,
      canEvents: true,
      canReports: false,
      canHours: false,
      canRenewals: false,
      canTasks: false,
      canMembers: false,
      canGrant: false,
    }]} />);

    expect(screen.getByRole("link", { name: "مجلس التقنية" }).getAttribute("href")).toBe("/manage/organizations/org-2");
    expect(screen.getByRole("link", { name: "فعاليات الجهة" }).getAttribute("href")).toBe("/manage/organizations/org-2/events");
    expect(screen.queryByRole("link", { name: "طلبات الأعضاء" })).toBeNull();
    expect(screen.queryByRole("link", { name: "الساعات" })).toBeNull();
  });

  it("returns to the same workspace page for account sections from management screens", () => {
    render(<MyPageNavigation locale="ar" sectionBase="/me" organizations={[]} />);

    expect(screen.getByRole("link", { name: "نظرة عامة" }).getAttribute("href")).toBe("/me#overview");
    expect(screen.getByRole("link", { name: "بياناتي الأساسية" }).getAttribute("href")).toBe("/me#profile");
  });

  it("uses the shared workspace sidebar for system administration without student destinations", () => {
    render(<MyPageNavigation locale="ar" organizations={[]} superAdmin />);

    const sidebar = screen.getByRole("complementary", { name: "تنقل مساحتي" });
    expect(sidebar.className).toContain("workspace-sidebar");
    expect(screen.getByRole("link", { name: "نظرة عامة" }).getAttribute("href")).toBe("/manage#overview");
    expect(screen.getByRole("link", { name: "الجهات" }).getAttribute("href")).toBe("/manage/organizations");
    expect(screen.getByRole("link", { name: "إعدادات الحساب" }).getAttribute("href")).toBe("/manage/account");
    expect(screen.queryByRole("link", { name: "الإشعارات" })).toBeNull();
    expect(screen.queryByRole("link", { name: "ملفي المهاري" })).toBeNull();
  });
});
