// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
const lookup = vi.hoisted(() => vi.fn());
vi.mock("./admin-organization-actions", () => ({
  findOrganizationLeader: lookup,
}));
import { LeaderEmailSearch } from "./leader-email-search";
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it("retains every typed character in Arabic and English, and permits editing a selected email", async () => {
  lookup.mockResolvedValue([{name:"طالب",email:"leader@example.invalid"}]);
  render(<form><LeaderEmailSearch locale="ar" required/></form>);
  const input=screen.getByRole("combobox",{name:"بريد القائد"}) as HTMLInputElement;
  for(const text of ["l","le","lea","lead","ق","قا","قائ","قائد"]){
    fireEvent.change(input,{target:{value:text}});
    expect(input.value).toBe(text);
  }
  fireEvent.change(input,{target:{value:"leader@"}});
  fireEvent.click(await screen.findByRole("option",{name:/leader@example.invalid/}));
  fireEvent.change(input,{target:{value:"new"}});
  expect(input.value).toBe("new");
});
it("finds an eligible leader and submits the selected email without exposing internal IDs", async () => {
  lookup.mockResolvedValue([
    { name: "طالب تجريبي", email: "leader@example.invalid" },
  ]);
  const { container } = render(
    <form>
      <LeaderEmailSearch locale="ar" required />
    </form>,
  );
  const input = screen.getByRole("combobox", { name: "بريد القائد" });
  fireEvent.change(input, { target: { value: "leader@" } });
  await waitFor(() => expect(lookup).toHaveBeenCalledWith("leader@"));
  fireEvent.click(
    await screen.findByRole("option", {
      name: /^طالب تجريبي\s*leader@example\.invalid$/,
    }),
  );
  expect(new FormData(container.querySelector("form")!).get("email")).toBe(
    "leader@example.invalid",
  );
  expect(
    screen
      .getByRole("combobox", { name: "بريد القائد" })
      .getAttribute("aria-expanded"),
  ).toBe("false");
});
