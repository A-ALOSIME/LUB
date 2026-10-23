// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@xyflow/react", () => import("../../../../../tests/helpers/react-flow"));
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
    committees: slug === "ieee-club" ? [{ id: "ieee-media", name: "الإعلام", description: "", parentCommitteeId: null }] : [],
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

  const chart = screen.getByRole("group", { name: "الهيكل التنظيمي للجان" });
  expect(chart.querySelector('[data-node-id="organization-cybersecurity-club-id"]')?.textContent).toContain("نادي الأمن السيبراني");
  expect(screen.getByText("لجنة التقنية").closest(".committee-flow-card")).toBeTruthy();
  expect(screen.getByText("الفريق التقني").closest(".committee-flow-card")).toBeTruthy();
  expect(chart.querySelectorAll(".committee-flow-card")).toHaveLength(3);
  expect(chart.querySelectorAll("[data-edge]")).toHaveLength(2);
  expect(chart.querySelector('[data-edge="committee-tech:committee-tech-child"]')).toBeTruthy();
  expect(chart.querySelectorAll("[data-slot=badge]")).toHaveLength(0);
  expect(screen.queryByRole("button", { name: "إجراءات لجنة التقنية" })).toBeNull();
  expect(screen.queryByText("بدون قائد")).toBeNull();
  expect(chart.closest(".committee-flow")).toBeTruthy();
  expect(chart.querySelector('[data-node-id="organization-cybersecurity-club-id"]')?.textContent).toContain("القائد: أحمد العتيبي");
  expect(screen.queryByRole("heading", { name: "قيادة الجهة" })).toBeNull();
  expect(document.getElementById("organization-leadership-card")).toBeNull();
  expect(chart.querySelector(".organization-committee-description")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "عرض تفاصيل لجنة التقنية" }));
  expect(screen.getByRole("dialog").textContent).toContain("تطوير المبادرات التقنية.");
});

it("does not restore deleted committees or leadership from curated profile descriptions", async () => {
  const organizationData = await readPublicOrganization("oss-club");
  if (!organizationData) throw new Error("Expected mocked organization data");
  vi.mocked(readPublicOrganization).mockResolvedValueOnce({ ...organizationData, committees: [], leadership: [] });
  const page = await OrganizationPage({ params: Promise.resolve({ slug: "oss-club" }), searchParams: Promise.resolve({ section: "structure" }) });
  render(page);
  expect(screen.queryByRole("tab", { name: "اللجان" })).toBeNull();
  expect(screen.queryByRole("group", { name: "الهيكل التنظيمي للجان" })).toBeNull();
  expect(screen.queryByText("رئيسة المجتمع • مديرة العمليات")).toBeNull();
  expect(screen.queryByRole("button", { name: "عرض تفاصيل إدارة الابتكار التقني" })).toBeNull();
});

it("keeps contact links above section pages and groups the club overview", async () => {
  const page = await OrganizationPage({
    params: Promise.resolve({ slug: "cybersecurity-club" }),
    searchParams: Promise.resolve({}),
  });
  render(page);

  const navigation = screen.getByRole("navigation", { name: "أقسام نادي الأمن السيبراني" });
  const contact = document.getElementById("organization-contact");

  expect(screen.getByRole("tab", { name: "عن الجهة" }).getAttribute("aria-selected")).toBe("true");
  expect(screen.queryByRole("tab", { name: "اللجان" })).toBeNull();
  expect(navigation.querySelectorAll('[role="tab"]')).toHaveLength(1);
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

it("shows Dhaheer goals in the common overview as a concise list", async () => {
  const page = await OrganizationPage({
    params: Promise.resolve({ slug: "dhaheer-club" }),
    searchParams: Promise.resolve({ section: "about" }),
  });
  render(page);

  const navigation = screen.getByRole("navigation", { name: "أقسام نادي ظهير" });
  expect(screen.getByRole("tab", { name: "عن الجهة" }).getAttribute("aria-selected")).toBe("true");
  expect(navigation.querySelectorAll('[role="tab"]')).toHaveLength(1);
  expect(screen.getByRole("heading", { name: "التطوع وخدمة المجتمع" })).toBeTruthy();
  expect(document.querySelector("#organization-profile-about .organization-profile-items--bulleted")).toBeTruthy();
});

it("shows IEEE programs and fields in their separate standard tabs", async () => {
  const page = await OrganizationPage({
    params: Promise.resolve({ slug: "ieee-club" }),
    searchParams: Promise.resolve({ section: "programs" }),
  });
  render(page);

  expect(screen.getByRole("heading", { name: "البرامج" })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "المجالات" })).toBeNull();
  expect(screen.getByRole("tab", { name: "المجالات" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "المعسكرات" })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "الأهداف" })).toBeNull();
  expect(screen.queryByRole("heading", { name: "IEEE عالميًا" })).toBeNull();
  expect(screen.getByRole("tab", { name: "البرامج" }).getAttribute("aria-selected")).toBe("true");
  expect(screen.getByRole("tab", { name: "المجالات" }).getAttribute("aria-selected")).toBe("false");
  expect(document.querySelectorAll("#organization-profile-programs .organization-profile-section-icon").length).toBeGreaterThan(0);
});

it("shows the IEEE committees only on the structure page", async () => {
  const page = await OrganizationPage({
    params: Promise.resolve({ slug: "ieee-club" }),
    searchParams: Promise.resolve({ section: "structure" }),
  });
  render(page);

  expect(screen.getByRole("heading", { name: "اللجان" })).toBeTruthy();
  expect(screen.getByRole("group", { name: "الهيكل التنظيمي للجان" })).toBeTruthy();
  expect(screen.getByText("الإعلام")).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "هدفنا وأهداف النادي" })).toBeNull();
  expect(screen.queryByRole("heading", { name: "البرامج" })).toBeNull();
});

it("uses the same populated tab names and order for clubs and councils, ending in committees", async () => {
  const data = await readPublicOrganization("custom-logo-club");
  if (!data) throw new Error("Expected organization");
  for (const typeCode of ["Club", "Council"]) {
    vi.mocked(readPublicOrganization).mockResolvedValueOnce({ ...data, organization: { ...data.organization, typeCode, mission: "", memberCount: 0, publicProfileContent: { goals: "هدف", fields: "مجال", programs: "برنامج", achievements: "إنجاز", partners: "شريك" } }, committees: [{ id: "committee", name: "لجنة", description: "", parentCommitteeId: null }] });
    const ui = render(await OrganizationPage({ params: Promise.resolve({ slug: "custom-logo-club" }), searchParams: Promise.resolve({}) }));
    expect(screen.getAllByRole("tab").map(tab => tab.textContent)).toEqual(["عن الجهة", "المجالات", "البرامج", "الإنجازات", "الشركاء", "اللجان"]);
    expect(screen.queryByRole("tab", { name: "الهيكلة" })).toBeNull();
    ui.unmount();
  }
});
it("removes empty tabs and recreates them when actual content or committees are added", async () => {
  const data = await readPublicOrganization("custom-logo-club");
  if (!data) throw new Error("Expected organization");
  const empty = { ...data, organization: { ...data.organization, mission: "", memberCount: 0, publicProfileContent: { vision: "", offerings: "", goals: "", fields: "", programs: "", achievements: "", partners: "" } }, committees: [], leadership: [] };
  vi.mocked(readPublicOrganization).mockResolvedValueOnce(empty);
  const ui = render(await OrganizationPage({ params: Promise.resolve({ slug: "custom-logo-club" }), searchParams: Promise.resolve({ section: "structure" }) }));
  expect(screen.queryByRole("tablist")).toBeNull();
  expect(screen.queryByRole("group", { name: "الهيكل التنظيمي للجان" })).toBeNull();
  ui.unmount();
  vi.mocked(readPublicOrganization).mockResolvedValueOnce({ ...empty, organization: { ...empty.organization, publicProfileContent: { partners: "شريك جديد" } }, committees: [{ id: "new", name: "لجنة جديدة", description: "", parentCommitteeId: null }] });
  render(await OrganizationPage({ params: Promise.resolve({ slug: "custom-logo-club" }), searchParams: Promise.resolve({}) }));
  expect(screen.getAllByRole("tab").map(tab => tab.textContent)).toEqual(["الشركاء", "اللجان"]);
  expect(screen.getByRole("heading", { name: "الشركاء" })).toBeTruthy();
});
