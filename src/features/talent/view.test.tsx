// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it,vi } from "vitest";
import type { PublicTalent, TalentPages } from "./repository";
import { PublicTalentView, TalentCards } from "./view";

vi.mock("./profile-skill-actions",()=>({loadProfileSkills:vi.fn(),saveProfileSkills:vi.fn(),searchProfileSkillCatalog:vi.fn()}));
afterEach(cleanup);

const pages: TalentPages = { organizations: 0, events: 0, projects: 0, sources: 0 };
const profile: PublicTalent = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "أحمد فهد العصيّمي",
  major: "نظم معلومات",
  level: "12",
  bio: null,
  total: null,
  avatar_version: null,
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

it("formats membership dates and keeps zero-hour totals", () => {
  render(<PublicTalentView profile={profile} pages={pages} />);
  expect(screen.getByRole("heading", { name: "أحمد فهد العصيّمي" })).toBeTruthy();
  expect(screen.getAllByText("أ").length).toBeGreaterThan(0);
  expect(screen.getByText(/12 أكتوبر 2026/)).toBeTruthy();
  expect(screen.getByText("0 ساعة معتمدة")).toBeTruthy();
});

it("renders icon-only LinkedIn and GitHub links without exposing their URLs", () => {
  render(<PublicTalentView profile={{
    ...profile,
    links: [
      { kind: "LinkedIn", label: "LinkedIn", value: "https://linkedin.com/in/student" },
      { kind: "GitHub", label: "GitHub", value: "https://github.com/student" },
    ],
  }} pages={pages} />);
  const linkedIn = screen.getByRole("link", { name: "حساب LinkedIn" });
  const github = screen.getByRole("link", { name: "حساب GitHub" });
  expect(linkedIn.getAttribute("href")).toBe("https://linkedin.com/in/student");
  expect(github.getAttribute("href")).toBe("https://github.com/student");
  expect(linkedIn.className).toContain("size-10");
  expect(linkedIn.getAttribute("target")).toBe("_blank");
  expect(screen.queryByText("https://linkedin.com/in/student")).toBeNull();
  expect(screen.queryByText("https://github.com/student")).toBeNull();
  expect(document.querySelectorAll("svg").length).toBeGreaterThanOrEqual(2);
});

it("shows numeric zero statistics and shows organization avatar fallbacks in memberships",()=>{render(<PublicTalentView profile={profile} pages={pages}/>);expect(screen.getByText("فعاليات")).toBeTruthy();expect(screen.getAllByText("ساعة")[0]).toBeTruthy();expect(screen.getAllByText("ن")[0]).toBeTruthy();});

it("limits card skills and organizations, keeps zero hours, and centers a single result", () => {
 render(<TalentCards items={[{...profile, skills:["Python","SQL","React","Figma","JavaScript"], organizations:Array.from({length:4},(_,i)=>({slug:String(i),name:`جهة ${i}`,logo:null}))}]} />);
 expect(screen.getByText("و 2 أخرى")).toBeTruthy();
 expect(screen.getByText("+1")).toBeTruthy();
 expect(screen.getByText("0 ساعة معتمدة")).toBeTruthy();
 expect(screen.getByRole("list").className).toContain("justify-center");
 expect(document.querySelectorAll('[data-slot="card-footer"] [data-size="lg"]').length).toBe(4);
});
it("places the bio inside the identity card and displays chronological roles with collapse",()=>{
 render(<PublicTalentView profile={{...profile,bio:"نبذة قصيرة",organizations:[{...profile.organizations[0],hours:"4",memberships:[{...profile.organizations[0].memberships[0],roles:[{code:"OL",starts:"2026-10-20",ends:null,hours:"2"},{code:"OD",starts:"2026-10-15",ends:"2026-10-20",hours:"2"},{code:"CL",starts:"2026-10-12",ends:"2026-10-15",hours:"0"}]}]}]}} pages={pages}/>);
 expect(screen.getByText("نبذة قصيرة").closest('[data-slot="card"]')?.querySelector('h1')).toBeTruthy();
 expect(screen.getByRole("button",{name:/عرض المزيد/})).toBeTruthy();
 expect(document.querySelector('[data-slot="avatar"].size-24')).toBeTruthy();
});

it("merges duplicate roles within an organization while retaining leadership as a separate role",()=>{
 render(<PublicTalentView profile={{...profile,organizations:[{...profile.organizations[0],memberships:[{start_date:"2025-10-01",end_date:"2026-01-01",status_code:"Ended",roles:[{code:"Member",starts:"2025-10-01",ends:"2026-01-01",hours:"1"}]},{start_date:"2026-02-01",end_date:null,status_code:"Active",roles:[{code:"Member",starts:"2026-02-01",ends:null,hours:"2"},{code:"OL",starts:"2026-10-01",ends:null,hours:"3"}]}]}]}} pages={pages}/>);
 expect(screen.getAllByText("عضو")).toHaveLength(1);expect(screen.getByText("قائد النادي")).toBeTruthy();expect(screen.getByText(/1 أكتوبر 2025/)).toBeTruthy();expect(screen.queryByRole("button",{name:/عرض المزيد/})).toBeNull();
});

it("resets visible skills when navigating between different public profile slugs",()=>{
 const {rerender}=render(<PublicTalentView profile={{...profile,skills:["Python"]}} pages={pages}/>);
 expect(screen.getByRole("link",{name:"Python"})).toBeTruthy();
 rerender(<PublicTalentView profile={{...profile,id:"00000000-0000-4000-8000-000000000003",skills:["SQL"]}} pages={pages}/>);
 expect(screen.queryByRole("link",{name:"Python"})).toBeNull();expect(screen.getByRole("link",{name:"SQL"})).toBeTruthy();
});
