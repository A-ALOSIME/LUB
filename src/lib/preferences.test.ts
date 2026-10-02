import { expect, it, vi } from "vitest";

const cookieValues = vi.hoisted(() => ({ theme: undefined as string | undefined }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => name === "lub-theme" && cookieValues.theme ? { value: cookieValues.theme } : undefined }),
}));

import { getPreferences } from "./preferences";

it("starts in dark mode without a saved preference and preserves explicit choices", async () => {
  cookieValues.theme = undefined;
  expect((await getPreferences()).theme).toBe("dark");
  cookieValues.theme = "light";
  expect((await getPreferences()).theme).toBe("light");
  cookieValues.theme = "dark";
  expect((await getPreferences()).theme).toBe("dark");
});
