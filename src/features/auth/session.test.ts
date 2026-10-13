import { beforeEach, describe, expect, it, vi } from "vitest";
const provider = vi.hoisted(() => ({ getUser: vi.fn() }));
const request = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: provider }) }));
vi.mock("next/headers", () => ({ headers: async () => request.headers }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
import { getVerifiedProxyIdentity, requireUser, requireVerifiedProxyIdentity } from "./session";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-key");
  request.headers = new Headers();
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
  it("accepts only a proxy-forwarded UUID for read-only management pages", async () => {
    request.headers.set("x-lub-verified-user-id", "00000000-0000-4000-8000-000000000123");
    await expect(getVerifiedProxyIdentity()).resolves.toEqual({ id: "00000000-0000-4000-8000-000000000123" });
    await expect(requireVerifiedProxyIdentity()).resolves.toEqual({ id: "00000000-0000-4000-8000-000000000123" });
    expect(provider.getUser).not.toHaveBeenCalled();
  });
  it("rejects a missing or malformed proxy-forwarded UUID", async () => {
    request.headers.set("x-lub-verified-user-id", "forged");
    await expect(getVerifiedProxyIdentity()).resolves.toBeNull();
    await expect(requireVerifiedProxyIdentity()).rejects.toThrow("redirect:/login");
  });
  it("fails closed on provider rejection and network failure", async () => {
    provider.getUser.mockResolvedValue({ data: { user: { id: "forged" } }, error: { message: "invalid token" } });
    await expect(requireUser()).rejects.toThrow("redirect:/login");
    provider.getUser.mockRejectedValue(new Error("network failure"));
    await expect(requireUser()).rejects.toThrow("redirect:/login");
  });
});
