// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/components/public-header", () => ({ PublicHeader: () => null }));
vi.mock("@/features/public-site/published-page", () => ({usesPublishedPages: () => false, PublishedPage: () => null}));
vi.mock("@/lib/preferences", () => ({ getPreferences: async () => ({ locale: "ar", theme: "light" }) }));
vi.mock("@/features/organizations/public-data", () => ({ readPublicDirectory: vi.fn(async () => ({
  organizations: [
    { id: "1", slug: "council", nameAr: "مجلس الطلاب", typeCode: "Council", statusCode: "Active", summary: "", tags: [] },
    { id: "2", slug: "club", nameAr: "نادي التقنية", typeCode: "Club", statusCode: "Active", summary: "", tags: [] },
    { id: "3", slug: "ieee", nameAr: "نادي IEEE", typeCode: "Club", statusCode: "Active", summary: "", tags: [] },
  ], hasNext: false,
})) }));
import OrganizationsPage from "./page";
afterEach(cleanup);

it("shows councils before clubs and makes the whole entry a single link", async () => {
  render(await OrganizationsPage({ searchParams: Promise.resolve({}) }));
  const sections = screen.getAllByRole("region");
  expect(within(sections[0]).getByRole("heading", { name: "المجالس" })).toBeTruthy();
  expect(within(sections[1]).getByRole("heading", { name: "الأندية" })).toBeTruthy();
  expect(within(sections[0]).getByRole("link", { name: "عرض مجلس الطلاب" }).getAttribute("href")).toBe("/organizations/council");
  expect(screen.queryByRole("searchbox")).toBeNull();
});

it("uses the supplied optimized IEEE logo and keeps the card itself as the only action", async () => {
  render(await OrganizationsPage({ searchParams: Promise.resolve({}) }));
  const ieeeLink = screen.getByRole("link", { name: "عرض نادي IEEE" });
  expect(ieeeLink.getAttribute("href")).toBe("/organizations/ieee");
  expect(ieeeLink.querySelector("img")?.getAttribute("src")).toBe("/club-logos/ieee.webp");
  expect(ieeeLink.textContent).not.toContain("عرض التفاصيل");
  expect(ieeeLink.textContent).not.toContain("↗");
});