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
