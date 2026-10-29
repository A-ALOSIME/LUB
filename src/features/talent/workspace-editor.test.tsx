// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import type { TalentPages, TalentWorkspace } from "./repository";
import { TalentWorkspaceEditor } from "./workspace-editor";

vi.mock("./skill-search-actions",()=>({suggestTalentSkills:vi.fn().mockResolvedValue([])}));
vi.mock("./actions", () => ({ mutateTalent: vi.fn() }));
vi.mock("./form", () => ({ TalentForm: ({ children }: { children?: ReactNode }) => <div>{children}</div>, NewProject: () => null, ProjectFields: () => null }));
vi.mock("./view", () => ({ TalentPagination: () => null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

afterEach(cleanup);

const data: TalentWorkspace = {
  status: "Active",
  onboarded: true,
  bio: "",
  settings: { public_profile_enabled: false },
  links: [],
  skills: [{ name: "Python", public: true }],
  projects: [],
  sources: [],
};
const pages: TalentPages = { organizations: 0, events: 0, projects: 0, sources: 0 };

it("shows skill names without the decorative sparkle icon", () => {
  render(<TalentWorkspaceEditor data={data} user="student" pages={pages} />);

  const skill = screen.getByText("Python").closest("li");
  expect(skill).not.toBeNull();
  expect(skill?.querySelector("svg.lucide-sparkles")).toBeNull();
});

it("uses the organization contact menu before opening the add-channel form", async () => {
  render(<TalentWorkspaceEditor data={data} user="student" pages={pages} />);

  fireEvent.click(screen.getByRole("button", { name: "إضافة قناة" }));
  const menu = await screen.findByRole("menu");
  for (const label of ["البريد", "الهاتف", "الموقع", "LinkedIn", "X", "TikTok", "Instagram"]) {
    expect(within(menu).getByRole("menuitem", { name: new RegExp(label) })).toBeTruthy();
  }
  expect(screen.queryByRole("dialog")).toBeNull();

  fireEvent.click(within(menu).getByRole("menuitem", { name: /X/ }));
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByLabelText("حساب X")).toBeTruthy();
  expect(within(dialog).queryByRole("button", { name: "GitHub" })).toBeNull();
});

it("keeps the public profile link in the publish footer", () => {
  render(<TalentWorkspaceEditor data={{ ...data, settings: { public_profile_enabled: true,public_slug:"11111111-1111-4111-8111-111111111111" } }} user="student" pages={pages} />);

  const view = screen.getByRole("link", { name: "عرض الملف العام" });
  expect(view.closest(".workspace-page-header")).toBeNull();
  expect(view.parentElement?.textContent).toContain("نشر ملفي");
});

it("offers only whole-profile visibility controls",()=>{render(<TalentWorkspaceEditor data={{...data,links:[{id:"link",link_type:"GitHub",label:"GitHub",url_or_value:"https://github.com/student",is_public:true}]}} user="student" pages={pages}/>);expect(screen.queryByRole("button",{name:/إخفاء المهارة|إظهار المهارة|إخفاء قناة|إظهار قناة/})).toBeNull();expect(screen.getByRole("button",{name:"نشر ملفي المهاري"})).toBeTruthy();});
