// @vitest-environment jsdom
import {
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ProfileSkills } from "./profile-skills";
import { orderProfileSkills, type ProfileSkill } from "./profile-skills-model";
import { loadProfileSkills, saveProfileSkills } from "./profile-skill-actions";
vi.mock("./profile-skill-actions", () => ({
  loadProfileSkills: vi.fn(),
  saveProfileSkills: vi.fn(),
  searchProfileSkillCatalog: vi.fn().mockResolvedValue([]),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const skills: ProfileSkill[] = Array.from({ length: 13 }, (_, i) => ({
  key: `s${i}`,
  labelAr: `مهارة ${i}`,
  labelEn: `Skill ${i}`,
  category: {
    key: i % 2 ? "design" : "programming",
    labelAr: i % 2 ? "تصميم" : "برمجة",
    labelEn: i % 2 ? "Design" : "Programming",
  },
  featured: false,
  order: i,
  tasks: i === 1 ? 3 : 0,
  events: 0,
  filterValue: `مهارة ${i}`,
}));
it("hides empty visitor skills and offers an owner edit action", () => {
  const { rerender } = render(
    <ProfileSkills initialSkills={[]} slug="profile" />,
  );
  expect(screen.queryByText("المهارات")).toBeNull();
  rerender(<ProfileSkills initialSkills={[]} slug="profile" owner />);
  expect(screen.getByRole("button", { name: "إضافة مهارة" })).toBeTruthy();
});
it("sorts automatic featured skills by actual tasks then name and respects saved featured order", () => {
  expect(orderProfileSkills(skills, "en")[0].key).toBe("s1");
  expect(
    orderProfileSkills(
      [
        { ...skills[0], featured: true, order: 2 },
        { ...skills[1], featured: true, order: 0 },
      ],
      "ar",
    ).map((s) => s.key),
  ).toEqual(["s1", "s0"]);
});
it("shows bilingual category labels, hides zero evidence, filters by the original skill and expands the rest", () => {
  render(<ProfileSkills initialSkills={skills} slug="profile" locale="en" />);
  expect(screen.getByText(/3 tasks/)).toBeTruthy();
  expect(screen.queryByText("0 tasks")).toBeNull();
  expect(screen.getByText("Programming")).toBeTruthy();
  expect(
    screen
      .getByRole("link", { name: /Skill 1 · 3 tasks/ })
      .getAttribute("href"),
  ).toBe(`/talent?skill=${encodeURIComponent("مهارة 1")}`);
  expect(screen.getAllByRole("link")).toHaveLength(11);
  fireEvent.click(screen.getByRole("button", { name: "Show all" }));
  expect(screen.getAllByRole("link")).toHaveLength(13);
});
it("requires deletion confirmation, sends saved order and features, and rolls back an unsuccessful optimistic save", async () => {
  vi.mocked(loadProfileSkills).mockResolvedValue({
    skills: skills.slice(0, 2),
  });
  vi.mocked(saveProfileSkills).mockResolvedValue({ error: true });
  render(
    <ProfileSkills
      initialSkills={skills.slice(0, 2)}
      slug="profile"
      owner
      locale="en"
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Edit skills" }));
  const dialog = await screen.findByRole("dialog");
  await waitFor(() =>
    expect(
      within(dialog).getAllByRole("button", { name: "Remove skill" }),
    ).toHaveLength(2),
  );
  fireEvent.click(
    within(dialog).getAllByRole("button", { name: "Remove skill" })[0],
  );
  const confirm = await screen.findByRole("alertdialog");
  fireEvent.click(within(confirm).getByRole("button", { name: "Remove" }));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Feature skill" }),
  );
  fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
  await screen.findByText(/Could not save skills/);
  expect(saveProfileSkills).toHaveBeenCalledWith("profile", [
    { key: "s1", featured: true },
  ]);
  expect(document.querySelectorAll("[data-profile-skills] a")).toHaveLength(2);
});
