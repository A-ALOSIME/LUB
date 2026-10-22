import { NextRequest } from "next/server";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const refresh = vi.hoisted(() => vi.fn());
vi.mock("@supabase/ssr", () => ({ createServerClient: refresh }));
import { proxy } from "./proxy";

beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", ""); vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", ""); });
afterEach(() => vi.unstubAllEnvs());
describe("session proxy", () => {
  it("uses a fresh CSP nonce on each response and prevents HTML caching", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const first = await proxy(new NextRequest("http://localhost/me"));
    const second = await proxy(new NextRequest("http://localhost/me"));
    expect(first.headers.get("content-security-policy")).toContain("'nonce-");
    expect(first.headers.get("content-security-policy")).not.toContain("unsafe-eval");
    expect(first.headers.get("content-security-policy")).not.toEqual(second.headers.get("content-security-policy"));
    expect(first.headers.get("cache-control")).toBe("private, no-store");
  });
  it("passes refreshed cookies to both the server render and browser", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-key");
    const getClaims = vi.fn();
    const getUser = vi.fn();
    refresh.mockImplementation((_url, _key, options) => {
      getClaims.mockImplementation(async () => {
        options.cookies.setAll([{ name: "sb-session", value: "refreshed-test-session", options: { httpOnly: true, sameSite: "lax" } }], { "cache-control": "private, no-store" });
        return { data: { claims: {} }, error: null };
      });
      return { auth: { getClaims, getUser } };
    });
    const response = await proxy(new NextRequest("http://localhost/me", { headers: { cookie: "sb-session=old-test-session" } }));
    expect(response.cookies.get("sb-session")?.value).toBe("refreshed-test-session");
    expect(response.headers.get("x-middleware-request-cookie")).toContain("sb-session=refreshed-test-session");
    expect(response.headers.get("content-security-policy")).toContain("'nonce-");
    expect(getClaims).toHaveBeenCalledOnce();
    expect(getUser).not.toHaveBeenCalled();
  });
  it("forwards only the subject from an authenticated, verified JWT", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-key");
    const getClaims = vi.fn(async () => ({ data: { claims: {
      sub: "00000000-0000-4000-8000-000000000123",
      role: "authenticated",
      aud: "authenticated",
      is_anonymous: false,
    } }, error: null }));
    refresh.mockReturnValue({ auth: { getClaims } });

    const response = await proxy(new NextRequest("http://localhost/manage", {
      headers: { "x-lub-verified-user-id": "00000000-0000-4000-8000-000000000999" },
    }));

    expect(response.headers.get("x-middleware-request-x-lub-verified-user-id")).toBe("00000000-0000-4000-8000-000000000123");
    expect(getClaims).toHaveBeenCalledOnce();
  });
  it("marks administrator account settings so the profile read can authorize the navigation", async () => {
    const response = await proxy(new NextRequest("http://localhost/manage/account"));
    expect(response.headers.get("x-middleware-request-x-lub-management-view")).toBe("account");
  });
  it("does not forward subjects from anonymous or malformed claims", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-key");
    const getClaims = vi.fn(async () => ({ data: { claims: {
      sub: "not-a-uuid",
      role: "authenticated",
      aud: "authenticated",
      is_anonymous: false,
    } }, error: null }));
    refresh.mockReturnValue({ auth: { getClaims } });

    const response = await proxy(new NextRequest("http://localhost/manage", {
      headers: { "x-lub-verified-user-id": "00000000-0000-4000-8000-000000000999" },
    }));

    expect(response.headers.get("x-middleware-request-x-lub-verified-user-id")).toBeNull();
  });
});
