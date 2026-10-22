// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { readPublicOrganization } from "@/features/organizations/public-data";

const mocks = vi.hoisted(() => ({
  getVerifiedUser: vi.fn().mockResolvedValue(null),
  canManageOrganizationSettings: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/components/public-header", () => ({ PublicHeader: () => null }));
vi.mock("@/features/auth/session", () => ({ getVerifiedUser: mocks.getVerifiedUser }));
vi.mock("@/features/auth/authorization", () => ({ isSuperAdminUser: async () => false }));
vi.mock("@/features/organizations/management-repository", () => ({ canManageOrganizationSettings: mocks.canManageOrganizationSettings }));
vi.mock("@/lib/preferences", () => ({ getPreferences: async () => ({ locale: "ar", theme: "dark" }) }));
vi.mock("@/features/organizations/public-data", () => ({
  readPublicOrganization: vi.fn(async (slug: string) => ({
    organization: {
      id: `${slug}-id`,
      slug,
      nameAr: slug === "custom-logo-club" ? "نادي تجريبي" : slug === "student-council" ? "المجلس الطلابي" : slug === "ieee-club" ? "نادي IEEE" : slug === "tuwaiq-club" ? "نادي طويق" : slug === "dhaheer-club" ? "نادي ظهير" : slug === "oss-club" ? "مجتمع OSS" : "نادي الأمن السيبراني",
      typeCode: slug === "student-council" ? "Council" : "Club",
      logoUrl: ["custom-logo-club", "student-council"].includes(slug) ? `https://logos.example/${slug}.svg` : "",
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

afterEach(() => {
  cleanup();
  mocks.getVerifiedUser.mockReset().mockResolvedValue(null);
  mocks.canManageOrganizationSettings.mockReset().mockResolvedValue(false);
});

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
  expect(screen.queryByRole("link", { name: "إعدادات الجهة" })).toBeNull();
});

it("shows a return link to organization settings for its manager", async () => {
  mocks.getVerifiedUser.mockResolvedValueOnce({ id: "manager-id" });
  mocks.canManageOrganizationSettings.mockResolvedValueOnce(true);
  const page = await OrganizationPage({
    params: Promise.resolve({ slug: "custom-logo-club" }),
    searchParams: Promise.resolve({}),
  });
  render(page);

  expect(screen.getByRole("link", { name: "إعدادات الجهة" }).getAttribute("href")).toBe("/manage/organizations/custom-logo-club-id");
});

it("uses a manager-uploaded organization logo on the public page", async () => {
  const page = await OrganizationPage({
    params: Promise.resolve({ slug: "custom-logo-club" }),
    searchParams: Promise.resolve({}),
  });
  render(page);

  const logo = screen.getByAltText("شعار نادي تجريبي");
  expect(logo.getAttribute("src")).toBe("https://logos.example/custom-logo-club.svg");
});

it("shows a custom logo alongside an existing council cover", async () => {
  const page = await OrganizationPage({
    params: Promise.resolve({ slug: "student-council" }),
    searchParams: Promise.resolve({}),
  });
  render(page);

  expect(screen.getByAltText("شعار المجلس الطلابي").getAttribute("src")).toBe("https://logos.example/student-council.svg");
  expect(screen.getByAltText("غلاف المجلس الطلابي")).toBeTruthy();
});

it("renders a read-only committee chart with leadership inside the organization root", async () => {
  const organizationData = await readPublicOrganization("cybersecurity-club");
  if (!organizationData) throw new Error("Expected mocked organization data");
  vi.mocked(readPublicOrganization).mockResolvedValueOnce({
    ...organizationData,
    committees: [
      { id: "committee-tech", name: "لجنة التقنية", description: "تطوير المبادرات التقنية.", parentCommitteeId: null },
      { id: "committee-tech-child", name: "الفريق التقني", description: "", parentCommitteeId: "committee-tech" },
    ],
    leadership: [{ roleCode: "OL", fullName: "أحمد العتيبي" }],
  });
  const page = await OrganizationPage({
    params: Promise.resolve({ slug: "cybersecurity-club" }),
    searchParams: Promise.resolve({ section: "structure" }),
  });
  render(page);

  const chart = screen.getByRole("list", { name: "الهيكل التنظيمي للجان" });
  expect(chart.querySelector(".organization-org-chart-root-name")?.textContent).toBe("نادي الأمن السيبراني");
  expect(screen.getByText("لجنة التقنية").closest(".organization-committee-node")).toBeTruthy();
  expect(screen.getByText("الفريق التقني").closest(".organization-committee-node")).toBeTruthy();
  expect(chart.querySelectorAll(".organization-committee-node")).toHaveLength(2);
  expect(chart.closest(".organization-org-chart-viewport")?.querySelectorAll(".organization-org-chart-row")).toHaveLength(2);
  expect(chart.querySelectorAll(".organization-status-badge")).toHaveLength(0);
  expect(chart.querySelectorAll("button")).toHaveLength(2);
  expect(chart.querySelectorAll(".organization-committee-meta")).toHaveLength(0);
  expect(chart.closest(".organization-org-chart-viewport")?.classList.contains("organization-org-chart-viewport--public")).toBe(true);
  expect(chart.querySelector(".organization-org-chart-root-details")?.textContent).toContain("القائد: أحمد العتيبي");
  expect(screen.queryByRole("heading", { name: "قيادة الجهة" })).toBeNull();
  expect(document.getElementById("organization-leadership-card")).toBeNull();
  expect(chart.querySelector(".organization-committee-description")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "عرض تفاصيل لجنة التقنية" }));
  expect(screen.getByRole("dialog").textContent).toContain("تطوير المبادرات التقنية.");
});

it("moves curated leadership positions above the public committee grid", async () => {
  const organizationData = await readPublicOrganization("oss-club");
  if (!organizationData) throw new Error("Expected mocked organization data");
  vi.mocked(readPublicOrganization).mockResolvedValueOnce({ ...organizationData, committees: [], leadership: [] });
  const page = await OrganizationPage({
    params: Promise.resolve({ slug: "oss-club" }),
    searchParams: Promise.resolve({ section: "structure" }),
  });
  render(page);

  const chart = screen.getByRole("list", { name: "الهيكل التنظيمي للجان" });
  const rootDetails = chart.querySelector(".organization-org-chart-root-details");
  expect(rootDetails?.textContent).toContain("رئيسة المجتمع • مديرة العمليات");
  const committeeNames = [...chart.querySelectorAll(".organization-committee-name")].map(node => node.textContent);
  expect(committeeNames).not.toContain("رئيسة المجتمع ومديرة العمليات");
  const rootChildren = chart.querySelector(".organization-org-chart-children--root");
  const topLevelCommittees = [...(rootChildren?.querySelectorAll(":scope > .organization-org-chart-row--root > .organization-committee-row--root") ?? [])];
  expect(topLevelCommittees.map(node => node.querySelector(".organization-committee-name")?.textContent)).toEqual([
    "إدارة الابتكار التقني",
    "مبادرة تقدم الأعضاء",
    "إدارة العلاقات العامة",
    "إدارة التخطيط والتنفيذ",
    "إدارة الموارد البشرية",
    "إدارة الإعلام والتصميم",
  ]);
  expect(chart.querySelectorAll(".organization-committee-node")).toHaveLength(14);
  const innovation = topLevelCommittees.find(node => node.querySelector(".organization-committee-name")?.textContent === "إدارة الابتكار التقني");
  expect([...innovation!.querySelectorAll(".organization-org-chart-children--branch .organization-committee-name")].map(node => node.textContent)).toEqual([
    "لجنة الذكاء الاصطناعي",
    "لجنة التطوير",
  ]);
  expect(innovation?.querySelector(".organization-committee-description")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "عرض تفاصيل إدارة الابتكار التقني" }));
  expect(screen.getByRole("dialog").textContent).toContain("مستودعات GitHub");
  expect(screen.getByRole("dialog").textContent).not.toContain("لجنة الذكاء الاصطناعي");
});

it("keeps contact links above section pages and groups the club overview", async () => {
  const page = await OrganizationPage({
    params: Promise.resolve({ slug: "cybersecurity-club" }),
    searchParams: Promise.resolve({}),
  });
  render(page);

  const navigation = screen.getByRole("navigation", { name: "أقسام نادي الأمن السيبراني" });
  const contact = document.getElementById("organization-contact");

  expect(screen.getByRole("tab", { name: "عن النادي" }).getAttribute("aria-selected")).toBe("true");
  expect(screen.getByRole("tab", { name: "اللجان" }).getAttribute("aria-selected")).toBe("false");
  expect(navigation.querySelectorAll('[role="tab"]')).toHaveLength(2);
  expect(screen.getByRole("heading", { name: "الأهداف" })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "اللجان" })).toBeNull();
  expect(contact).toBeTruthy();
  expect(contact!.compareDocumentPosition(navigation) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.queryByRole("tab", { name: "قنوات التواصل" })).toBeNull();
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

  expect(screen.getByRole("tab", { name: "البرامج" }).getAttribute("aria-selected")).toBe("false");
  expect(screen.getByRole("tab", { name: "اللجان" }).getAttribute("aria-selected")).toBe("false");
  expect(screen.getByRole("tab", { name: "الإنجازات" }).getAttribute("aria-selected")).toBe("false");
  expect(screen.getByRole("heading", { name: "IEEE عالميًا" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "الأهداف" })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "برامج النادي" })).toBeNull();
  expect(screen.queryByRole("heading", { name: "اللجان والفريق" })).toBeNull();
  expect(navigation.querySelectorAll('[role="tab"]').length).toBeGreaterThan(3);
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
  expect(screen.getByRole("tab", { name: "الأهداف" }).getAttribute("aria-selected")).toBe("true");
  expect(navigation.querySelectorAll('[role="tab"]')).toHaveLength(2);
  expect(screen.getByRole("heading", { name: "التطوع وخدمة المجتمع" })).toBeTruthy();
  expect(document.querySelector("#organization-profile-details-0 .organization-profile-items--bulleted")).toBeTruthy();
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
  expect(screen.getByRole("tab", { name: "البرامج" }).getAttribute("aria-selected")).toBe("true");
  expect(screen.queryByRole("tab", { name: "المجالات" })).toBeNull();
  expect(document.querySelectorAll("#organization-profile-programs .organization-profile-section-icon").length).toBe(0);
});

it("shows the IEEE committees only on the structure page", async () => {
  const page = await OrganizationPage({
    params: Promise.resolve({ slug: "ieee-club" }),
    searchParams: Promise.resolve({ section: "structure" }),
  });
  render(page);

  expect(screen.getByRole("heading", { name: "اللجان" })).toBeTruthy();
  expect(screen.getByRole("list", { name: "الهيكل التنظيمي للجان" })).toBeTruthy();
  expect(screen.getByText("الإعلام")).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "هدفنا وأهداف النادي" })).toBeNull();
  expect(screen.queryByRole("heading", { name: "البرامج" })).toBeNull();
});
