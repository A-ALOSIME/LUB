import { beforeEach, describe, expect, it, vi } from "vitest";
const provider = vi.hoisted(() => ({ getUser: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: provider }) }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
import { requireUser } from "./session";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-key");
});
describe("verified server identity", () => {
  it("rejects a missing or unverified identity", async () => {
    provider.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(requireUser()).rejects.toThrow("redirect:/login");
    provider.getUser.mockResolvedValue({ data: { user: { id: "user-1", email: "student@example.com" } }, error: null });
    await expect(requireUser()).rejects.toThrow("redirect:/login");
  });
  it("returns only an identity freshly verified by the provider", async () => {
    provider.getUser.mockResolvedValue({ data: { user: { id: "user-1", email: "student@example.com", email_confirmed_at: "2026-09-26T10:00:00Z", user_metadata: { role: "super_admin" } } }, error: null });
    expect(await requireUser()).toEqual({ id: "user-1", email: "student@example.com", emailVerifiedAt: "2026-09-26T10:00:00Z" });
  });
  it("fails closed on provider rejection and network failure", async () => {
    provider.getUser.mockResolvedValue({ data: { user: { id: "forged" } }, error: { message: "invalid token" } });
    await expect(requireUser()).rejects.toThrow("redirect:/login");
    provider.getUser.mockRejectedValue(new Error("network failure"));
    await expect(requireUser()).rejects.toThrow("redirect:/login");
  });
});
