// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/components/public-header", () => ({ PublicHeader: () => null }));
vi.mock("@/features/auth/session", () => ({ getVerifiedUser: async () => null }));
vi.mock("@/features/auth/authorization", () => ({ isSuperAdminUser: async () => false }));
vi.mock("@/lib/preferences", () => ({ getPreferences: async () => ({ locale: "ar", theme: "dark" }) }));
vi.mock("@/features/organizations/public-data", () => ({
  readPublicOrganization: vi.fn(async (slug: string) => ({
    organization: {
      id: `${slug}-id`,
      slug,
      nameAr: slug === "ieee-club" ? "نادي IEEE" : slug === "tuwaiq-club" ? "نادي طويق" : slug === "dhaheer-club" ? "نادي ظهير" : "نادي الأمن السيبراني",
      typeCode: "Club",
      summary: "حاضنة طلابية للأمن السيبراني.",
      statusCode: "Active",
      archivedAt: null,
      tags: [],
      mission: null,
    },
    committees: [],
    contacts: [],
    leadership: [],
    rounds: [],
    upcomingEvents: [],
    announcements: [],
    moreCommittees: false,
  })),
}));

import OrganizationPage from "./page";

afterEach(cleanup);

it("fits the cyber security logo and keeps social links inside the organization card", async () => {
  const page = await OrganizationPage({
    params: Promise.resolve({ slug: "cybersecurity-club" }),
    searchParams: Promise.resolve({}),
  });
  render(page);

  const logo = screen.getByAltText("شعار نادي الأمن السيبراني");
  expect(logo.getAttribute("style")).toContain("height: 180%");
  expect(logo.getAttribute("style")).toContain("object-fit: contain");
  const contact = screen.getByRole("heading", { name: "روابط التواصل" }).closest("#organization-contact");
  expect(contact?.closest("#organization-overview")).toBeTruthy();
  expect(screen.queryByText("تابع الجهة أو تواصل معها عبر الروابط المتاحة.")).toBeNull();
});

it("keeps contact links above section pages and groups the club overview", async () => {
  const page = await OrganizationPage({
    params: Promise.resolve({ slug: "cybersecurity-club" }),
    searchParams: Promise.resolve({}),
  });
  render(page);

  const navigation = screen.getByRole("navigation", { name: "أقسام نادي الأمن السيبراني" });
  const contact = document.getElementById("organization-contact");

  expect(screen.getByRole("link", { name: "عن النادي" }).getAttribute("href")).toBe("/organizations/cybersecurity-club");
  expect(screen.getByRole("link", { name: "اللجان" }).getAttribute("href")).toBe("/organizations/cybersecurity-club?section=structure");
  expect(navigation.querySelectorAll("a").length).toBe(2);
  expect(screen.getByRole("heading", { name: "الأهداف" })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "اللجان" })).toBeNull();
  expect(contact).toBeTruthy();
  expect(contact!.compareDocumentPosition(navigation) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(navigation.querySelector('a[href="/organizations/cybersecurity-club?section=contact"]')).toBeNull();
  expect(document.getElementById("organization-contact")).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "برامج النادي" })).toBeNull();
});

it("keeps IEEE overview content visible with concise section names", async () => {
  const page = await OrganizationPage({
    params: Promise.resolve({ slug: "ieee-club" }),
    searchParams: Promise.resolve({}),
  });
  render(page);

  const navigation = screen.getByRole("navigation", { name: "أقسام نادي IEEE" });

  expect(screen.getByRole("link", { name: "البرامج" }).getAttribute("href")).toBe("/organizations/ieee-club?section=programs");
  expect(screen.getByRole("link", { name: "اللجان" }).getAttribute("href")).toBe("/organizations/ieee-club?section=structure");
  expect(screen.getByRole("link", { name: "الإنجازات" }).getAttribute("href")).toBe("/organizations/ieee-club?section=impact");
  expect(screen.getByRole("heading", { name: "IEEE عالميًا" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "الأهداف" })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "برامج النادي" })).toBeNull();
  expect(screen.queryByRole("heading", { name: "اللجان والفريق" })).toBeNull();
  expect(navigation.querySelectorAll("a").length).toBeGreaterThan(3);
  expect(screen.queryByText("اكتشف النادي وخطوتك التالية")).toBeNull();
  expect(screen.queryByAltText("صفحة اكتشف النادي وبها رموز QR للأعمال والانضمام والتواصل")).toBeNull();
  expect(screen.queryByText("عرض التفاصيل")).toBeNull();
  expect(screen.queryByText(/تعرّف على أعمال النادي، وانضم إليه/)).toBeNull();
});

it("gives Dhaheer goals their own page as a concise list", async () => {
  const page = await OrganizationPage({
    params: Promise.resolve({ slug: "dhaheer-club" }),
    searchParams: Promise.resolve({ section: "details-0" }),
  });
  render(page);

  const navigation = screen.getByRole("navigation", { name: "أقسام نادي ظهير" });
  expect(screen.getByRole("link", { name: "الأهداف" }).getAttribute("href")).toBe("/organizations/dhaheer-club?section=details-0");
  expect(navigation.querySelectorAll("a")).toHaveLength(2);
  expect(screen.getByRole("heading", { name: "التطوع وخدمة المجتمع" })).toBeTruthy();
  expect(document.querySelector("#organization-profile .organization-profile-items--bulleted")).toBeTruthy();
});

it("renders IEEE programs and fields together on one concise page", async () => {
  const page = await OrganizationPage({
    params: Promise.resolve({ slug: "ieee-club" }),
    searchParams: Promise.resolve({ section: "programs" }),
  });
  render(page);

  expect(screen.getByRole("heading", { name: "البرامج" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "المجالات" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "المعسكرات" })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "الأهداف" })).toBeNull();
  expect(screen.queryByRole("heading", { name: "IEEE عالميًا" })).toBeNull();
  expect(screen.getByRole("link", { name: "البرامج" }).getAttribute("aria-current")).toBe("page");
  expect(screen.queryByRole("link", { name: "المجالات" })).toBeNull();
  expect(document.querySelectorAll("#organization-profile .organization-profile-section-icon").length).toBe(0);
});

it("shows the IEEE committees only on the structure page", async () => {
  const page = await OrganizationPage({
    params: Promise.resolve({ slug: "ieee-club" }),
    searchParams: Promise.resolve({ section: "structure" }),
  });
  render(page);

  expect(screen.getByRole("heading", { name: "اللجان" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "الإعلام" })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "هدفنا وأهداف النادي" })).toBeNull();
  expect(screen.queryByRole("heading", { name: "البرامج" })).toBeNull();
});
