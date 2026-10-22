// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/components/public-header", () => ({ PublicHeader: () => null }));
vi.mock("@/features/public-site/published-page", () => ({usesPublishedPages: () => false, PublishedPage: () => null}));
vi.mock("@/lib/preferences", () => ({ getPreferences: async () => ({ locale: "ar", theme: "light" }) }));
vi.mock("@/features/organizations/public-data", () => ({ readPublicDirectory: vi.fn(async () => ({
  organizations: [
    { id: "1", slug: "council", nameAr: "مجلس الطلاب", typeCode: "Council", statusCode: "Active", summary: "", tags: [] },
    { id: "2", slug: "club", nameAr: "نادي التقنية", typeCode: "Club", statusCode: "Active", summary: "", tags: [] },
    { id: "3", slug: "ieee", nameAr: "نادي IEEE", typeCode: "Club", statusCode: "Active", summary: "وصف تجريبي طويل", tags: ["تقنية"] },
    { id: "4", slug: "cybersecurity-club", nameAr: "نادي الأمن السيبراني", typeCode: "Club", statusCode: "Active", summary: "", tags: [] },
  ], hasNext: false,
})) }));
vi.mock("next/link", async () => {
  const { createElement } = await import("react");
  return {
    default: ({ children, prefetch, ...props }: React.ComponentProps<"a"> & { prefetch?: boolean | null }) =>
      createElement("a", { ...props, "data-prefetch": String(prefetch) }, children),
  };
});
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
  expect(ieeeLink.textContent).toContain("تقنية");
  expect(ieeeLink.textContent).not.toContain("فرع طلابي يحوّل المعرفة التقنية");
  expect(ieeeLink.textContent).not.toContain("وصف تجريبي طويل");
  expect(ieeeLink.querySelector(".organization-card-summary")).toBeNull();
});

it("prefetches a club profile on intent and positions the CyberSec mark lower in its card", async () => {
  render(await OrganizationsPage({ searchParams: Promise.resolve({}) }));
  const link = screen.getByRole("link", { name: "عرض نادي الأمن السيبراني" });
  const logo = link.querySelector(".organization-card-image");

  expect(link.getAttribute("data-prefetch")).toBe("false");
  expect(logo?.getAttribute("style")).toContain("translateY(8px) scale(2.078)");

  fireEvent.mouseEnter(link);

  expect(link.getAttribute("data-prefetch")).toBe("true");
});
