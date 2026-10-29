// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SuperAdminDashboard } from "./admin-dashboard";

afterEach(cleanup);

describe("super admin dashboard", () => {
  it("shows active and archived organizations separately", () => {
    render(<SuperAdminDashboard locale="ar" summary={{ activeOrganizations: 12, archivedOrganizations: 1, administrators: 1 }} />);

    expect(screen.getByText("١٢")).toBeTruthy();
    expect(screen.getByText("الجهات النشطة")).toBeTruthy();
    expect(screen.getAllByText("١")).toHaveLength(2);
    expect(screen.getByText("الجهات المؤرشفة")).toBeTruthy();
  });

  it("keeps administrative destinations in the persistent workspace menu rather than duplicating them in the overview", () => {
    render(<SuperAdminDashboard locale="ar" summary={{ activeOrganizations: 12, archivedOrganizations: 1, administrators: 1 }} />);

    expect(screen.getByRole("heading", { name: "نظرة عامة" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /إدارة الجهات|إدارة المشرفين|الفصول الأكاديمية|إعدادات حسابي/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "إنشاء الجهة" })).toBeNull();
  });

  it("does not render duplicate destination links in the overview", () => {
    render(<SuperAdminDashboard locale="ar" summary={{ activeOrganizations: 12, archivedOrganizations: 1, administrators: 1 }} />);

    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});
