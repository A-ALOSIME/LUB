import { expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ user: vi.fn() }));
vi.mock("@/features/auth/session", () => ({ getVerifiedUser: mocks.user }));
import { GET } from "./route";

it("keeps retired hours exports behind verified authentication", async () => {
  mocks.user.mockResolvedValue(null);
  expect((await GET()).status).toBe(401);
});

it("retires the direct hours export without contacting Edge or exposing data", async () => {
  mocks.user.mockResolvedValue({ id: "verified" });
  const fetch = vi.spyOn(globalThis, "fetch");
  try {
    const response = await GET();
    expect(response.status).toBe(410);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.has("Content-Disposition")).toBe(false);
    expect(await response.text()).toBe("");
    expect(fetch).not.toHaveBeenCalled();
  } finally {
    fetch.mockRestore();
  }
});
