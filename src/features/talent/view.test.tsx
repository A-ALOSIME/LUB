// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import type { PublicTalent, TalentPages } from "./repository";
import { PublicTalentView } from "./view";

afterEach(cleanup);

const pages: TalentPages = { organizations: 0, events: 0, projects: 0, sources: 0 };
const profile: PublicTalent = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "أحمد فهد العصيّمي",
  major: "نظم معلومات",
  level: "12",
  bio: null,
  total: null,
  skills: [],
  links: [],
  organizations: [{
    id: "00000000-0000-4000-8000-000000000002",
    name: "نادي الاختبار",
    slug: "test-club",
    archived: false,
    hours: null,
    memberships: [{ start_date: "2026-10-12", end_date: null, status_code: "Active", roles: [] }],
  }],
  events: [],
  projects: [],
};

it("formats membership dates in Arabic and hides zero-hour totals", () => {
  render(<PublicTalentView profile={profile} pages={pages} />);
  expect(screen.getByRole("heading", { name: "أحمد فهد العصيّمي" })).toBeTruthy();
  expect(screen.getByText("أ")).toBeTruthy();
  expect(screen.getByText("عضو منذ الاثنين، 12 أكتوبر 2026")).toBeTruthy();
  expect(screen.queryByText(/ساعة معتمدة/)).toBeNull();
});

it("renders icon-only LinkedIn and GitHub links without exposing their URLs", () => {
  render(<PublicTalentView profile={{
    ...profile,
    links: [
      { kind: "LinkedIn", label: "LinkedIn", value: "https://linkedin.com/in/student" },
      { kind: "GitHub", label: "GitHub", value: "https://github.com/student" },
    ],
  }} pages={pages} />);
  const linkedIn = screen.getByRole("link", { name: "LinkedIn" });
  const github = screen.getByRole("link", { name: "GitHub" });
  expect(linkedIn.getAttribute("href")).toBe("https://linkedin.com/in/student");
  expect(github.getAttribute("href")).toBe("https://github.com/student");
  expect(linkedIn.className).toContain("hover:bg-accent");
  expect(screen.queryByText("https://linkedin.com/in/student")).toBeNull();
  expect(screen.queryByText("https://github.com/student")).toBeNull();
  expect(document.querySelectorAll("svg").length).toBeGreaterThanOrEqual(2);
});
