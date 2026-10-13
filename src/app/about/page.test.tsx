import { expect, it, vi } from "vitest";

const redirects = vi.hoisted(() => ({ permanentRedirect: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => redirects);

import AboutPage from "./page";

it("redirects the old About URL to the home About section", async () => {
  await AboutPage();

  expect(redirects.permanentRedirect).toHaveBeenCalledOnce();
  expect(redirects.permanentRedirect).toHaveBeenCalledWith("/#about");
});
