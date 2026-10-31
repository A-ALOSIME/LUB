// @vitest-environment jsdom
import {
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ActivitySkillField } from "./activity-skill-field";
import { searchActivitySkills } from "./activity-skill-actions";
import { activitySkillKeys } from "./activity-skill-input";
import type { ProfileSkill } from "./profile-skills-model";
vi.mock("./activity-skill-actions", () => ({ searchActivitySkills: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const python: ProfileSkill = {
  key: "python",
  labelAr: "بايثون",
  labelEn: "Python",
  category: { key: "programming", labelAr: "برمجة", labelEn: "Programming" },
  featured: false,
  order: 0,
  tasks: 0,
  events: 0,
  filterValue: "Python",
};
it("searches the dictionary, serializes canonical keys and removes selected chips", async () => {
  vi.mocked(searchActivitySkills).mockResolvedValue([python]);
  const { container } = render(
    <form>
      <ActivitySkillField kind="Task" locale="en" />
    </form>,
  );
  fireEvent.focus(screen.getByRole("combobox"));
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "py" } });
  fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" });
  fireEvent.click(await screen.findByRole("option", { name: "Python" }));
  expect(
    activitySkillKeys(new FormData(container.querySelector("form")!)),
  ).toEqual(["python"]);
  expect(searchActivitySkills).toHaveBeenCalledWith("py");
  fireEvent.click(screen.getByRole("button", { name: "Remove Python" }));
  expect(
    activitySkillKeys(new FormData(container.querySelector("form")!)),
  ).toEqual([]);
});
it("retains existing choices when dictionary search fails and renders the locale and evidence rule", async () => {
  vi.mocked(searchActivitySkills).mockRejectedValue(new Error("network"));
  const { container } = render(
    <form>
      <ActivitySkillField kind="Event" initialSkills={[python]} />
    </form>,
  );
  expect(screen.getByText("بايثون")).toBeTruthy();
  expect(screen.getByText(/اكتمال الفعالية/)).toBeTruthy();
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "xx" } });
  await waitFor(() =>
    expect(screen.getByText(/تعذّر البحث عن المهارات/)).toBeTruthy(),
  );
  expect(
    activitySkillKeys(new FormData(container.querySelector("form")!)),
  ).toEqual(["python"]);
});
it("keeps omitted selections distinct from clearing and rejects unbounded or duplicated input", () => {
  const data = new FormData();
  expect(activitySkillKeys(data)).toBeNull();
  data.set("skills-present", "on");
  expect(activitySkillKeys(data)).toEqual([]);
  data.append("skill", "python");
  data.append("skill", "python");
  expect(() => activitySkillKeys(data)).toThrow();
  data.delete("skill");
  for (let i = 0; i < 31; i++) data.append("skill", `key${i}`);
  expect(() => activitySkillKeys(data)).toThrow();
});
