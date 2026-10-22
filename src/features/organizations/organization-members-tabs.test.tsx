// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OrganizationMembersTabs } from "./organization-members-tabs";

const navigation = vi.hoisted(() => ({
  pathname: "/manage/organizations/org-1/members",
  query: "",
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(navigation.query),
  useRouter: () => ({ push: navigation.push }),
}));

afterEach(() => {
  cleanup();
  navigation.pathname = "/manage/organizations/org-1/members";
  navigation.query = "";
  navigation.push.mockClear();
});

describe("organization members tabs", () => {
  it("shows the pending request count and keeps both panels available", () => {
    render(<OrganizationMembersTabs
      locale="ar"
      initialTab="members"
      pendingCount={3}
      memberPanel={<div>جدول الأعضاء</div>}
      applicationsPanel={<div>جدول الطلبات</div>}
    />);

    expect(screen.getByRole("tab", { name: /الأعضاء الحاليون/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /طلبات الانضمام.*3/ })).toBeTruthy();
    expect(screen.getByText("جدول الأعضاء")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /طلبات الانضمام/ }));
    expect(navigation.push).toHaveBeenCalledWith("/manage/organizations/org-1/members?section=applications", { scroll: false });
  });

  it("opens the applications tab for a legacy applications query", () => {
    navigation.query = "section=applications";
    render(<OrganizationMembersTabs
      locale="ar"
      initialTab="applications"
      pendingCount={0}
      memberPanel={<div>جدول الأعضاء</div>}
      applicationsPanel={<div>جدول الطلبات</div>}
    />);

    expect(screen.getByRole("tab", { name: /طلبات الانضمام/ }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("جدول الطلبات")).toBeTruthy();
  });
});
