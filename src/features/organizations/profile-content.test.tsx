// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { LocalOrganizationContent } from "./local-content";
import { OrganizationProfileContent } from "./profile-content";

afterEach(cleanup);

const profile: LocalOrganizationContent = {
  typeCode: "Club",
  matches: ["نادي تجريبي"],
  logoSrc: "/club-logos/cybersec.webp",
  imageTheme: "cybersec",
  stats: [{ value: "30+", label: "طالب مشارك" }],
  vision: "رؤية النادي",
  mission: "رسالة النادي",
  sections: [
    {
      title: "أهداف النادي",
      collapsible: true,
      highlightsOnly: true,
      items: [
        { title: "هدف بارز", body: "تفصيل الهدف البارز", highlighted: true },
        { title: "هدف غير مختار", body: "تفصيل غير مختار" },
      ],
    },
    {
      title: "اللجان والفريق",
      collapsible: true,
      items: [{ title: "لجنة التصميم" }],
    },
    {
      title: "أرشيف إضافي",
      collapsible: true,
      items: [{ title: "معلومة محفوظة" }],
    },
    {
      title: "برامج النادي",
      items: [{ title: "ورش تطبيقية" }],
    },
    {
      title: "الشركاء",
      items: [{ title: "جهات داعمة" }],
    },
    {
      title: "من IEEE العالمية إلى فرع الجامعة",
      items: [{ title: "منظمة مهنية عالمية", body: "تعريف بجهة IEEE العالمية." }],
    },
  ],
};

describe("organization profile content", () => {
  it("gives vision, mission, and objectives clear visual markers", () => {
    render(<OrganizationProfileContent profile={profile} en={false} />);

    for (const title of ["رؤيتنا", "رسالتنا", "الأهداف", "البرامج", "الشركاء"]) {
      const heading = screen.getByRole("heading", { name: title });
      expect(heading.parentElement?.querySelector("svg")).not.toBeNull();
    }

    expect(screen.getByLabelText("٣٠+")).toBeTruthy();
    expect(screen.getByText("أرشيف إضافي").parentElement?.querySelector("svg")).not.toBeNull();
  });

  it("shows committee names and curated highlights without a details toggle", () => {
    render(<OrganizationProfileContent profile={profile} en={false} />);

    const committee = screen.getByText("لجنة التصميم");
    const committeeCard = committee.closest(".organization-profile-committee-item");
    expect(committee.closest("details")).toBeNull();
    expect(committeeCard?.querySelector("svg")).not.toBeNull();
    expect(committeeCard?.querySelector('[data-status="public"]')?.textContent).toBe("عامة");
    expect(screen.getByText("هدف بارز").closest("details")).toBeNull();
    expect(screen.queryByText("هدف غير مختار")).toBeNull();
    expect(screen.getByText("معلومة محفوظة").closest("details")).not.toBeNull();
  });

  it("shows every detail directly when the profile section has its own page", () => {
    render(<OrganizationProfileContent profile={profile} en={false} expandSections />);

    expect(screen.getByText("أرشيف إضافي").closest("details")).toBeNull();
    expect(screen.getByText("معلومة محفوظة")).toBeTruthy();
    expect(screen.queryByText("عرض التفاصيل")).toBeNull();
  });

  it("right-aligns the IEEE global overview section", () => {
    render(<OrganizationProfileContent profile={profile} en={false} />);

    const heading = screen.getByRole("heading", { name: "IEEE عالميًا" });
    const section = heading.closest("section");
    expect(section?.getAttribute("dir")).toBe("rtl");
    expect(section?.classList.contains("organization-profile-section--rtl")).toBe(true);
  });
});
